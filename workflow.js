document.addEventListener('DOMContentLoaded', () => {
  const board = document.getElementById('workflow-board');
  const svg = document.getElementById('workflow-lines-svg');
  const runSimBtn = document.getElementById('btn-save-workflow');
  const resetBtn = document.getElementById('btn-workflow-reset');
  const zoomInBtn = document.getElementById('btn-workflow-zoom-in');

  if (!board || !svg) return;

  // Node database
  let nodes = [
    { id: 'node-1', title: 'Lead Captured', desc: 'New lead from website', type: 'trigger', x: 280, y: 20 },
    { id: 'node-2', title: 'AI Lead Scoring', desc: 'Score & qualify lead', type: 'aiaction', x: 280, y: 90 },
    { id: 'node-3', title: 'Score Check', desc: 'Score >= 70 ?', type: 'condition', x: 280, y: 160 },
    
    // High score branch (Left)
    { id: 'node-4', title: 'High Score', desc: 'True branch', type: 'action', x: 120, y: 230 },
    { id: 'node-5', title: 'Add to CRM', desc: 'Sync to Salesforce', type: 'integration', x: 120, y: 300 },
    { id: 'node-6', title: 'Send Email', desc: 'Welcome email', type: 'action', x: 120, y: 370 },
    { id: 'node-7', title: 'Notify Sales', desc: 'Slack alert', type: 'integration', x: 120, y: 440 },
    
    // Low score branch (Right)
    { id: 'node-8', title: 'Low Score', desc: 'False branch', type: 'action', x: 440, y: 230 },
    { id: 'node-9', title: 'Add to Nurture', desc: 'Email sequence', type: 'action', x: 440, y: 300 }
  ];

  // Connection list
  let connections = [
    { from: 'node-1', to: 'node-2' },
    { from: 'node-2', to: 'node-3' },
    // Branching
    { from: 'node-3', to: 'node-4' },
    { from: 'node-3', to: 'node-8' },
    // Left branch sequence
    { from: 'node-4', to: 'node-5' },
    { from: 'node-5', to: 'node-6' },
    { from: 'node-6', to: 'node-7' },
    // Right branch sequence
    { from: 'node-8', to: 'node-9' }
  ];

  let activeSimPath = []; // Track connection lines to highlight during simulation
  let zoomScale = 1;

  // -------------------------------------------------------------
  // 1. Render Nodes in DOM
  // -------------------------------------------------------------
  function renderWorkflow() {
    // Clear existing nodes except the SVG lines
    const existingNodes = board.querySelectorAll('.workflow-node');
    existingNodes.forEach(node => node.remove());

    nodes.forEach(node => {
      const nodeEl = document.createElement('div');
      nodeEl.className = `workflow-node ${node.type}`;
      nodeEl.id = node.id;
      nodeEl.style.left = `${node.x}px`;
      nodeEl.style.top = `${node.y}px`;

      let icon = 'fa-circle-info';
      if (node.type === 'trigger') icon = 'fa-bolt';
      else if (node.type === 'action') icon = 'fa-play';
      else if (node.type === 'condition') icon = 'fa-code-branch';
      else if (node.type === 'aiaction') icon = 'fa-robot';
      else if (node.type === 'delay') icon = 'fa-clock';
      else if (node.type === 'integration') icon = 'fa-share-nodes';

      nodeEl.innerHTML = `
        <div class="node-dot in"></div>
        <div class="workflow-node-title">
          <i class="fa-solid ${icon}"></i>
          <span>${node.title}</span>
        </div>
        <div class="workflow-node-desc">${node.desc}</div>
        <div class="node-dot out"></div>
      `;

      board.appendChild(nodeEl);
      makeNodeDraggable(nodeEl);

      // Node settings double click edit trigger
      nodeEl.addEventListener('dblclick', () => {
        openNodeEditor(node);
      });
    });

    drawConnections();
  }

  // -------------------------------------------------------------
  // 2. Draw SVG Connection Lines
  // -------------------------------------------------------------
  function drawConnections() {
    if (!svg || !board) return;
    svg.innerHTML = ''; // Clear lines
    
    connections.forEach(conn => {
      const fromEl = document.getElementById(conn.from);
      const toEl = document.getElementById(conn.to);
      if (!fromEl || !toEl) return;

      const fromDot = fromEl.querySelector('.node-dot.out');
      const toDot = toEl.querySelector('.node-dot.in');
      if (!fromDot || !toDot) return;

      const boardRect = board.getBoundingClientRect();
      const fromRect = fromDot.getBoundingClientRect();
      const toRect = toDot.getBoundingClientRect();

      // Skip drawing if nodes are hidden/collapsed (rectangles dimensions are 0)
      if (fromRect.width === 0 || toRect.width === 0) return;

      const x1 = (fromRect.left + fromRect.width / 2) - boardRect.left + board.scrollLeft;
      const y1 = (fromRect.top + fromRect.height / 2) - boardRect.top + board.scrollTop;
      const x2 = (toRect.left + toRect.width / 2) - boardRect.left + board.scrollLeft;
      const y2 = (toRect.top + toRect.height / 2) - boardRect.top + board.scrollTop;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const controlY = (y1 + y2) / 2;
      path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${controlY}, ${x2} ${controlY}, ${x2} ${y2}`);
      
      const isSimHighlighted = activeSimPath.some(pathConn => pathConn.from === conn.from && pathConn.to === conn.to);
      
      if (isSimHighlighted) {
        path.setAttribute('stroke', 'var(--color-secondary)');
        path.setAttribute('stroke-width', '3');
        path.style.filter = 'drop-shadow(0 0 4px var(--color-secondary))';
      } else {
        path.setAttribute('stroke', 'rgba(255, 255, 255, 0.15)');
        path.setAttribute('stroke-width', '2');
      }
      
      path.setAttribute('fill', 'none');
      svg.appendChild(path);
    });
  }

  // Export drawConnections globally so the SPA tab switcher can trigger redraws
  window.drawConnections = drawConnections;

  // Redraw when scrolling inside canvas
  board.addEventListener('scroll', drawConnections);

  // -------------------------------------------------------------
  // 3. Make Nodes Draggable
  // -------------------------------------------------------------
  function makeNodeDraggable(el) {
    let offsetX = 0, offsetY = 0;
    el.addEventListener('mousedown', dragMouseDown);
    el.addEventListener('touchstart', dragTouchStart, { passive: false });

    function dragMouseDown(e) {
      if (e.target.classList.contains('node-dot')) return; 
      e.preventDefault();
      offsetX = e.clientX - el.offsetLeft;
      offsetY = e.clientY - el.offsetTop;
      
      document.addEventListener('mouseup', closeDragElement);
      document.addEventListener('mousemove', elementDrag);
    }

    function dragTouchStart(e) {
      if (e.target.classList.contains('node-dot')) return; 
      e.preventDefault();
      const touch = e.touches[0];
      offsetX = touch.clientX - el.offsetLeft;
      offsetY = touch.clientY - el.offsetTop;
      
      document.addEventListener('touchend', closeDragTouch);
      document.addEventListener('touchmove', elementTouchDrag, { passive: false });
    }

    function elementDrag(e) {
      e.preventDefault();
      let left = e.clientX - offsetX;
      let top = e.clientY - offsetY;
      moveElement(left, top);
    }

    function elementTouchDrag(e) {
      e.preventDefault();
      const touch = e.touches[0];
      let left = touch.clientX - offsetX;
      let top = touch.clientY - offsetY;
      moveElement(left, top);
    }

    function moveElement(left, top) {
      left = Math.max(0, Math.min(board.scrollWidth - el.clientWidth, left));
      top = Math.max(0, Math.min(board.scrollHeight - el.clientHeight, top));

      el.style.left = `${left}px`;
      el.style.top = `${top}px`;

      const nodeIndex = nodes.findIndex(n => n.id === el.id);
      if (nodeIndex !== -1) {
        nodes[nodeIndex].x = left;
        nodes[nodeIndex].y = top;
      }

      drawConnections();
    }

    function closeDragElement() {
      document.removeEventListener('mouseup', closeDragElement);
      document.removeEventListener('mousemove', elementDrag);
    }

    function closeDragTouch() {
      document.removeEventListener('touchend', closeDragTouch);
      document.removeEventListener('touchmove', elementTouchDrag);
    }
  }

  // -------------------------------------------------------------
  // 4. Drag and Drop Palette Elements
  // -------------------------------------------------------------
  const paletteItems = document.querySelectorAll('.palette-item');
  let draggedType = null;

  paletteItems.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedType = item.dataset.type;
      e.dataTransfer.setData('text/plain', draggedType);
    });
  });

  board.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  board.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('text/plain');
    if (!type) return;

    const rect = board.getBoundingClientRect();
    const x = e.clientX - rect.left + board.scrollLeft - 60;
    const y = e.clientY - rect.top + board.scrollTop - 20;

    const id = `node-${Date.now()}`;
    let title = 'Custom Node';
    let desc = 'Configure properties';

    if (type === 'trigger') { title = 'API Trigger'; desc = 'Runs on custom webhook'; }
    else if (type === 'action') { title = 'Action Item'; desc = 'Execute script task'; }
    else if (type === 'condition') { title = 'Filter Gate'; desc = 'Define check rule'; }
    else if (type === 'aiaction') { title = 'AI Agent Action'; desc = 'Claude agent analysis'; }
    else if (type === 'delay') { title = 'Time Delay'; desc = 'Wait 5 minutes'; }
    else if (type === 'integration') { title = 'CRM Export'; desc = 'Export profile'; }

    const newNode = { id, title, desc, type, x, y };
    nodes.push(newNode);

    if (nodes.length > 1) {
      const prevNode = nodes[nodes.length - 2];
      connections.push({ from: prevNode.id, to: id });
    }

    renderWorkflow();
    
    if (window.logActivity) {
      window.logActivity('Workflow Builder', `Added new ${title} node to workspace.`);
    }
  });

  // -------------------------------------------------------------
  // 5. Run Step-by-Step Simulation
  // -------------------------------------------------------------
  let isSimulating = false;

  function runSimulation() {
    if (isSimulating) return;
    isSimulating = true;
    runSimBtn.disabled = true;
    runSimBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Simulating...';
    
    activeSimPath = [];
    document.querySelectorAll('.workflow-node').forEach(n => n.classList.remove('active-sim'));
    drawConnections();

    const highBranch = Math.random() > 0.4; 
    
    const steps = [
      { nodeId: 'node-1', log: 'Pipeline triggered: Lead Captured from website form submission.' },
      { nodeId: 'node-2', log: 'AI Lead Scoring running: Evaluated candidate parameters using Claude model.' },
      { nodeId: 'node-3', log: `Score Gate evaluation complete: Score is ${highBranch ? '85' : '42'}.` }
    ];

    if (highBranch) {
      steps.push(
        { nodeId: 'node-4', log: 'Branch Yes active: Routing to high value sales sequence.' },
        { nodeId: 'node-5', log: 'CRM update triggered: Synchronized lead profile to Salesforce database.' },
        { nodeId: 'node-6', log: 'Communication action: Sent customized introduction proposal.' },
        { nodeId: 'node-7', log: 'Workflow complete: Sent slack notification alert to sales channel.' }
      );
    } else {
      steps.push(
        { nodeId: 'node-8', log: 'Branch No active: Lead score below threshold (< 70).' },
        { nodeId: 'node-9', log: 'Automation triggered: Enrolled lead email in Nurture Campaign sequence.' }
      );
    }

    let stepIndex = 0;
    
    function executeNextStep() {
      if (stepIndex >= steps.length) {
        setTimeout(() => {
          document.querySelectorAll('.workflow-node').forEach(n => n.classList.remove('active-sim'));
          activeSimPath = [];
          drawConnections();
          runSimBtn.disabled = false;
          runSimBtn.innerHTML = 'Run Flow Simulation';
          isSimulating = false;
          
          if (window.logActivity) {
            window.logActivity('Workflow Builder', 'Pipeline simulation run completed successfully.');
          }
          if (window.appendChatMessage) {
            window.appendChatMessage('bot', `🤖 **Workflow execution simulation completed.** Evaluated Lead Scoring pathing: **${highBranch ? 'High Score Branch (Salesforce Sync)' : 'Low Score Branch (Nurture Campaign Enrollment)'}**.`);
          }
        }, 1200);
        return;
      }

      const step = steps[stepIndex];
      const nodeEl = document.getElementById(step.nodeId);
      
      if (nodeEl) {
        nodeEl.classList.add('active-sim');
        
        if (stepIndex > 0) {
          const prevNodeEl = document.getElementById(steps[stepIndex - 1].nodeId);
          if (prevNodeEl) prevNodeEl.classList.remove('active-sim');
          
          activeSimPath.push({ from: steps[stepIndex - 1].nodeId, to: step.nodeId });
          drawConnections();
        }

        if (window.logActivity) {
          window.logActivity('Workflow Sim', step.log);
        }
      }

      stepIndex++;
      setTimeout(executeNextStep, 900);
    }

    executeNextStep();
  }

  runSimBtn.addEventListener('click', runSimulation);

  // -------------------------------------------------------------
  // 6. Canvas Controls Interactions
  // -------------------------------------------------------------
  resetBtn.addEventListener('click', () => {
    nodes = [
      { id: 'node-1', title: 'Lead Captured', desc: 'New lead from website', type: 'trigger', x: 280, y: 20 },
      { id: 'node-2', title: 'AI Lead Scoring', desc: 'Score & qualify lead', type: 'aiaction', x: 280, y: 90 },
      { id: 'node-3', title: 'Score Check', desc: 'Score >= 70 ?', type: 'condition', x: 280, y: 160 },
      { id: 'node-4', title: 'High Score', desc: 'True branch', type: 'action', x: 120, y: 230 },
      { id: 'node-5', title: 'Add to CRM', desc: 'Sync to Salesforce', type: 'integration', x: 120, y: 300 },
      { id: 'node-6', title: 'Send Email', desc: 'Welcome email', type: 'action', x: 120, y: 370 },
      { id: 'node-7', title: 'Notify Sales', desc: 'Slack alert', type: 'integration', x: 120, y: 440 },
      { id: 'node-8', title: 'Low Score', desc: 'False branch', type: 'action', x: 440, y: 230 },
      { id: 'node-9', title: 'Add to Nurture', desc: 'Email sequence', type: 'action', x: 440, y: 300 }
    ];

    connections = [
      { from: 'node-1', to: 'node-2' },
      { from: 'node-2', to: 'node-3' },
      { from: 'node-3', to: 'node-4' },
      { from: 'node-3', to: 'node-8' },
      { from: 'node-4', to: 'node-5' },
      { from: 'node-5', to: 'node-6' },
      { from: 'node-6', to: 'node-7' },
      { from: 'node-8', to: 'node-9' }
    ];

    activeSimPath = [];
    zoomScale = 1;
    board.style.transform = 'scale(1)';
    renderWorkflow();
    
    if (window.logActivity) {
      window.logActivity('Workflow Builder', 'Pipeline workflow nodes reset to initial state.');
    }
  });

  zoomInBtn.addEventListener('click', () => {
    zoomScale = zoomScale === 1 ? 0.85 : 1;
    board.style.transform = `scale(${zoomScale})`;
    board.style.transformOrigin = 'top left';
    drawConnections();
  });

  // Node editor modal controls
  const nodeModal = document.getElementById('workflow-node-modal');
  const nodeModalClose = document.getElementById('node-modal-close-btn');
  const nodeEditForm = document.getElementById('node-edit-form');
  const editNodeId = document.getElementById('edit-node-id');
  const editNodeTitle = document.getElementById('edit-node-title');
  const editNodeDesc = document.getElementById('edit-node-desc');

  function openNodeEditor(node) {
    if (!nodeModal) return;
    editNodeId.value = node.id;
    editNodeTitle.value = node.title;
    editNodeDesc.value = node.desc;
    nodeModal.classList.add('open');
  }

  if (nodeModalClose) {
    nodeModalClose.addEventListener('click', () => nodeModal.classList.remove('open'));
  }
  if (nodeModal) {
    nodeModal.addEventListener('click', (e) => {
      if (e.target === nodeModal) nodeModal.classList.remove('open');
    });
  }

  if (nodeEditForm) {
    nodeEditForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = editNodeId.value;
      const title = editNodeTitle.value;
      const desc = editNodeDesc.value;

      const nodeIndex = nodes.findIndex(n => n.id === id);
      if (nodeIndex !== -1) {
        nodes[nodeIndex].title = title;
        nodes[nodeIndex].desc = desc;
        renderWorkflow();
        nodeModal.classList.remove('open');
        if (window.logActivity) {
          window.logActivity('Workflow Builder', `Node details updated to: '${title}'`);
        }
      }
    });
  }

  // Render on initial load
  renderWorkflow();

  window.addEventListener('resize', drawConnections);
});
