// Global error catcher for debugging visual and JS failures
window.addEventListener('error', (event) => {
  const errorMsg = `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`;
  console.error("DEBUG CAPTURED ERROR:", errorMsg, event.error);
  // Send to server log
  fetch(`/log-error?msg=${encodeURIComponent(errorMsg)}&stack=${encodeURIComponent(event.error ? event.error.stack : '')}`).catch(() => {});
  
  // Render red banner on screen
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed; top:0; left:0; width:100%; background:red; color:white; z-index:99999; padding:10px; font-family:monospace; font-size:12px; word-break:break-all; box-shadow: 0 4px 10px rgba(0,0,0,0.5);';
  banner.innerHTML = `<strong>Error:</strong> ${errorMsg}<br><pre style="margin:5px 0 0 0; font-size:10px; max-height:200px; overflow:auto; text-align:left;">${event.error ? event.error.stack : ''}</pre>`;
  if (document.body) {
    document.body.appendChild(banner);
  } else {
    window.addEventListener('DOMContentLoaded', () => document.body.appendChild(banner));
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const errorMsg = `Unhandled Rejection: ${event.reason}`;
  console.error("DEBUG CAPTURED REJECTION:", errorMsg);
  fetch(`/log-error?msg=${encodeURIComponent(errorMsg)}`).catch(() => {});
  
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed; top:0; left:0; width:100%; background:darkred; color:white; z-index:99999; padding:10px; font-family:monospace; font-size:12px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);';
  banner.innerHTML = `<strong>Promise Rejection:</strong> ${errorMsg}`;
  if (document.body) {
    document.body.appendChild(banner);
  } else {
    window.addEventListener('DOMContentLoaded', () => document.body.appendChild(banner));
  }
});

// Safe LocalStorage Wrapper to prevent security exceptions in file:// protocols
const safeStorage = {
  _mem: {},
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("Storage warning: localStorage.getItem failed, fallback to memory.", e);
      return this._mem[key] || null;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("Storage warning: localStorage.setItem failed, fallback to memory.", e);
      this._mem[key] = String(value);
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("Storage warning: localStorage.removeItem failed, fallback to memory.", e);
      delete this._mem[key];
    }
  }
};

function getGoogleClientId() {
  const saved = safeStorage.getItem('hub_settings');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      if (s.googleClientId) {
        return s.googleClientId;
      }
    } catch (e) {}
  }
  return '636480691678-nfijok21gr459sftck8fh1r6rg8hkavf.apps.googleusercontent.com';
}

// Google Identity Services (GIS) Core Initialization
let googleAuthInitialized = false;
let currentGoogleClientId = null;
window.initGoogleAuth = function(forceReset = false) {
  if (googleAuthInitialized && !forceReset) return;

  const container = document.getElementById('btn-google-login-container');
  const fallbackBtn = document.getElementById('btn-google-login');

  // If DOM is not yet ready, defer execution until DOMContentLoaded
  if (!container || !fallbackBtn) {
    document.addEventListener('DOMContentLoaded', () => {
      if (window.initGoogleAuth) window.initGoogleAuth(forceReset);
    });
    return;
  }

  const isLocalFile = window.location.protocol === 'file:';

  if (!isLocalFile && typeof google !== 'undefined' && google.accounts && google.accounts.id) {
    const clientId = getGoogleClientId();
    if (googleAuthInitialized && clientId === currentGoogleClientId && !forceReset) return;

    try {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleAuthCallback,
        auto_select: false
      });
      console.log("Google Identity Services initialized successfully with client ID:", clientId);

      container.innerHTML = '';
      container.style.display = 'flex';
      google.accounts.id.renderButton(
        container,
        { theme: 'outline', size: 'large', width: 240, text: 'signin_with', shape: 'pill' }
      );
      fallbackBtn.style.display = 'none';
      googleAuthInitialized = true;
      currentGoogleClientId = clientId;
    } catch (err) {
      console.error("GIS initialization failed:", err);
      container.style.display = 'none';
      fallbackBtn.style.display = 'flex';
    }
  } else {
    console.warn("Running in local simulation mode (either file:// origin or GSI library blocked/missing).");
    container.style.display = 'none';
    fallbackBtn.style.display = 'flex';
  }
};

function handleGoogleAuthCallback(response) {
  try {
    const base64Url = response.credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const payload = JSON.parse(jsonPayload);
    const userData = {
      name: payload.name || payload.email,
      email: payload.email,
      avatar: payload.picture || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'
    };
    loginUser(userData);
  } catch (err) {
    console.error("JWT decoding failed:", err);
    alert("Google authentication succeeded, but profile parsing failed. Signing in as Guest.");
    loginUser({ name: "Google Cloud User", email: "user@gmail.com", avatar: "https://randomuser.me/api/portraits/men/1.jpg" });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize GSI if script is loaded
  if (window.initGoogleAuth) window.initGoogleAuth();

  // 3D Particles Background Animation
  function init3DParticleCanvas(canvasId, maxParticles, particleColor, lineColor) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let particles = [];
    let animationId = null;

    function resize() {
      canvas.width = canvas.parentElement ? canvas.parentElement.clientWidth : window.innerWidth;
      canvas.height = canvas.parentElement ? canvas.parentElement.clientHeight : window.innerHeight;
    }
    
    resize();
    window.addEventListener('resize', resize);

    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.8;
        this.vy = (Math.random() - 0.5) * 0.8;
        this.radius = Math.random() * 2 + 1;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = particleColor;
        ctx.fill();
      }
    }

    for (let i = 0; i < maxParticles; i++) {
      particles.push(new Particle());
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.update();
        p.draw();
      });

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = lineColor.replace('ALPHA', String((1 - dist / 100) * 0.15));
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animationId = requestAnimationFrame(animate);
    }
    animate();
  }
  

  // -------------------------------------------------------------
  // 1. Session & Auth State Management (Google Login & GIS)
  // -------------------------------------------------------------
  const body = document.body;
  const startBtn = document.getElementById('btn-start-app');
  const triggerArea = document.getElementById('landing-trigger-area');
  const loginBtn = document.getElementById('btn-google-login');
  const backLandingLink = document.getElementById('auth-back-landing');
  const oauthModal = document.getElementById('google-oauth-modal');
  const accountsPicker = document.getElementById('google-accounts-picker');
  const guestBtn = document.getElementById('btn-google-oauth-guest');
  const guestForm = document.getElementById('oauth-guest-form');
  const portalSignoutBtn = document.getElementById('btn-portal-signout');

  // Header Profile DOM Elements
  const headerAvatar = document.getElementById('header-user-avatar');
  const headerName = document.getElementById('header-user-name');

  // Track active tab context globally
  let activeTab = 'command-center';

  function setStage(stageName) {
    body.className = `state-${stageName}`;
  }

  function loginUser(user) {
    safeStorage.setItem('auth_user', JSON.stringify(user));
    if (window.syncAllProfileViews) {
      window.syncAllProfileViews();
    } else {
      if (headerAvatar) headerAvatar.src = user.avatar;
      if (headerName) headerName.innerText = user.name;
    }
    setStage('dashboard');
    logActivity('System', `User ${user.name} logged in successfully via Google Sign-In.`);
    
    // Switch to active tab to trigger correct 3D perspective display
    switchTab(activeTab);
    
    // Lazy render charts after entering dashboard state
    setTimeout(() => {
      initAllCharts();
    }, 100);
  }
  window.loginUser = loginUser;

  // Transitions click triggers & 3D tilt hover mechanics
  if (triggerArea) {
    triggerArea.addEventListener('click', () => setStage('auth'));
    triggerArea.addEventListener('mousemove', (e) => {
      const rect = triggerArea.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const xc = rect.width / 2;
      const yc = rect.height / 2;
      const rotateX = -(y - yc) / 10;
      const rotateY = (x - xc) / 10;
      triggerArea.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.03)`;
      triggerArea.style.boxShadow = `0 30px 60px rgba(0, 0, 0, 0.6), ${-rotateY * 2}px ${rotateX * 2}px 30px rgba(139, 92, 246, 0.25)`;
    });
    triggerArea.addEventListener('mouseleave', () => {
      triggerArea.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
      triggerArea.style.boxShadow = '0 20px 50px rgba(0, 0, 0, 0.5)';
    });
  }
  if (startBtn) {
    startBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setStage('auth');
    });
  }
  if (backLandingLink) {
    backLandingLink.addEventListener('click', (e) => {
      e.preventDefault();
      setStage('landing');
    });
  }

  // Open Google Sign-In (Try GIS overlay, or fallback to selector modal)
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      if (typeof google !== 'undefined' && google.accounts && google.accounts.id && window.location.protocol !== 'file:') {
        try {
          google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
              console.log("One Tap dialog skipped, opening visual selector modal.");
              if (oauthModal) oauthModal.classList.add('open');
            }
          });
        } catch (e) {
          console.warn("GIS prompt failed, falling back to modal:", e);
          if (oauthModal) oauthModal.classList.add('open');
        }
      } else {
        if (oauthModal) oauthModal.classList.add('open');
      }
    });
  }

  // Close Selector Modal on Overlay Click
  if (oauthModal) {
    oauthModal.addEventListener('click', (e) => {
      if (e.target === oauthModal) {
        oauthModal.classList.remove('open');
      }
    });
  }

  // Select pre-configured Google account
  if (accountsPicker) {
    accountsPicker.addEventListener('click', (e) => {
      const row = e.target.closest('.profile-select-row');
      if (!row) return;

      const user = {
        name: row.dataset.name,
        email: row.dataset.email,
        avatar: row.dataset.avatar
      };

      oauthModal.classList.remove('open');
      loginUser(user);
    });
  }

  // Toggle Guest/Another account fields
  if (guestBtn) {
    guestBtn.addEventListener('click', () => {
      guestForm.style.display = guestForm.style.display === 'none' ? 'flex' : 'none';
    });
  }

  // Submit custom guest credentials
  if (guestForm) {
    guestForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('guest-input-name').value;
      const email = document.getElementById('guest-input-email').value;
      
      const randomId = Math.floor(Math.random() * 70) + 1;
      const avatar = `https://randomuser.me/api/portraits/men/${randomId}.jpg`;

      const user = { name, email, avatar };
      oauthModal.classList.remove('open');
      guestForm.reset();
      guestForm.style.display = 'none';
      loginUser(user);
    });
  }

  // Sign out click handler
  if (portalSignoutBtn) {
    portalSignoutBtn.addEventListener('click', () => {
      safeStorage.removeItem('auth_user');
      setStage('auth');
    });
  }

  // -------------------------------------------------------------
  // 2. 3D Perspective Tab-Switching Logic
  // -------------------------------------------------------------
  const dockButtons = document.querySelectorAll('.dock-item-btn');
  const panels = document.querySelectorAll('.dashboard-panel');

  function switchTab(tabId) {
    const targetPanel = document.getElementById(`panel-${tabId}`);
    if (!targetPanel) return;

    activeTab = tabId;
    // Update AI Generate drawer label
    const label = document.getElementById('drawer-context-label');
    if (label) {
      // Map IDs to titles
      const tabTitles = {
        'command-center': 'Command Center',
        'ai-suite': 'All-in-One Suite',
        'agent-marketplace': 'Agent Marketplace',
        'workflow-builder': 'Workflow Builder',
        'chat-assistant': 'Chat Assistant',
        'analytics': 'Analytics & Insights',
        'integrations': 'Integrations Grid',
        'knowledge-base': 'Knowledge Base',
        'advanced-features': 'Advanced Features',
        'settings': 'Settings & Customization',
        'web-builder': 'Website Builder',
        'proposal-generator': 'Proposal Generator',
        'resume-analyzer': 'Resume Analyzer',
        'interview-simulator': 'Interview Simulator',
        'open-lab': 'Open Innovation Lab',
        'app-store': 'AI App Store & Plugins'
      };
      label.innerText = tabTitles[tabId] || tabId;
    }

    const currentActivePanel = document.querySelector('.dashboard-panel.active');
    
    dockButtons.forEach(btn => {
      if (btn.dataset.tab === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (currentActivePanel === targetPanel) return;

    // Reset inline styles to let native CSS classes drive transitions cleanly
    panels.forEach(p => {
      p.style.transform = '';
      p.style.opacity = '';
      p.style.pointerEvents = '';
    });

    if (currentActivePanel) {
      currentActivePanel.classList.add('exit');
      currentActivePanel.classList.remove('active');
      
      targetPanel.classList.remove('exit');
      targetPanel.classList.add('active');
      
      if (tabId === 'workflow-builder' && window.drawConnections) {
        setTimeout(() => {
          window.drawConnections();
        }, 100);
      }
    } else {
      targetPanel.classList.remove('exit');
      targetPanel.classList.add('active');
    }

    logActivity('System', `Navigation panel switched to: ${tabId}`);
  }

  dockButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // -------------------------------------------------------------
  // 3. Real-Time Activity Logger System
  // -------------------------------------------------------------
  const activityLogger = document.getElementById('activity-logger');

  function logActivity(agentName, text) {
    if (!activityLogger) return;
    const li = document.createElement('li');
    li.className = 'activity-item';
    
    let iconClass = 'fa-circle-info';
    if (agentName.includes('Sales')) iconClass = 'fa-circle-plus';
    else if (agentName.includes('Finance')) iconClass = 'fa-file-invoice';
    else if (agentName.includes('Marketing')) iconClass = 'fa-bullhorn';
    else if (agentName.includes('HR')) iconClass = 'fa-user-group';
    else if (agentName.includes('System')) iconClass = 'fa-bolt';
    else if (agentName.includes('Workflow')) iconClass = 'fa-sitemap';

    li.innerHTML = `
      <div class="activity-item-left">
        <i class="fa-solid ${iconClass}"></i>
        <span><strong>${agentName}:</strong> ${text}</span>
      </div>
      <span class="activity-time">Just now</span>
    `;
    
    activityLogger.insertBefore(li, activityLogger.firstChild);
    if (activityLogger.children.length > 15) {
      activityLogger.removeChild(activityLogger.lastChild);
    }
  }
  window.logActivity = logActivity;

  // Auto-feeder loop: simulated activities from active agents
  const mockSystemEvents = [
    { agent: 'Sales Agent', text: 'Scored new lead (varaprasad@gmail.com) -> Qualification score: 88.' },
    { agent: 'Support Agent', text: 'Auto-replied to support ticket #8242 regarding billing queries.' },
    { agent: 'Finance Agent', text: 'Created invoice draft for Client ID #184 for the sum of $4,500.' },
    { agent: 'Marketing Agent', text: 'Scheduled automated LinkedIn post for tomorrow morning.' },
    { agent: 'HR Agent', text: 'Analyzed resume of candidate Alex Mercer: Job Match 92%.' },
    { agent: 'Analytics Agent', text: 'Audit complete: Conversion rates remained static (+0.2% variance).' }
  ];

  setInterval(() => {
    // Only feed if body is in dashboard state
    if (body.classList.contains('state-dashboard')) {
      // Pick random event
      const event = mockSystemEvents[Math.floor(Math.random() * mockSystemEvents.length)];
      // Check if that agent card is active in DOM
      let isAgentActive = true;
      const agentCheckboxes = document.querySelectorAll('.agent-card-large input[type="checkbox"]');
      agentCheckboxes.forEach(box => {
        if (box.dataset.agent === event.agent && !box.checked) {
          isAgentActive = false;
        }
      });

      if (isAgentActive) {
        logActivity(event.agent, event.text);
      }
    }
  }, 20000); // Trigger every 20 seconds

  // -------------------------------------------------------------
  // 4. Agent Marketplace Controls & Creator Modal
  // -------------------------------------------------------------
  function bindAgentToggles() {
    document.querySelectorAll('.agent-card-large input[type="checkbox"]').forEach(toggle => {
      // Remove old listeners to prevent duplicates
      toggle.removeEventListener('change', handleAgentToggle);
      toggle.addEventListener('change', handleAgentToggle);
    });
  }

  function handleAgentToggle(e) {
    const card = e.target.closest('.agent-card-large');
    const agentName = e.target.dataset.agent;
    const statusText = card.querySelector('.status-text');
    
    if (e.target.checked) {
      card.classList.add('active');
      statusText.innerText = 'Active';
      logActivity(agentName, 'Agent deployed successfully.');
    } else {
      card.classList.remove('active');
      statusText.innerText = 'Inactive';
      logActivity(agentName, 'Agent paused/undeployed.');
    }
  }

  bindAgentToggles();

  // Create custom agent modal triggers
  const agentModal = document.getElementById('agent-creator-modal');
  const agentModalClose = document.getElementById('agent-modal-close-btn');
  const agentForm = document.getElementById('agent-creator-form');

  const triggerCreatorBtn1 = document.getElementById('btn-marketplace-create');
  const triggerCreatorBtn2 = document.getElementById('trigger-agent-creation-form');

  function openAgentCreator() {
    agentModal.classList.add('open');
  }
  if (triggerCreatorBtn1) triggerCreatorBtn1.addEventListener('click', openAgentCreator);
  if (triggerCreatorBtn2) triggerCreatorBtn2.addEventListener('click', openAgentCreator);

  agentModalClose.addEventListener('click', () => agentModal.classList.remove('open'));
  agentModal.addEventListener('click', (e) => {
    if (e.target === agentModal) agentModal.classList.remove('open');
  });

  agentForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('new-agent-name').value;
    const role = document.getElementById('new-agent-role').value;
    const capability = document.getElementById('new-agent-capability').value;
    
    // Choose icon
    let icon = 'fa-robot';
    if (capability === 'support') icon = 'fa-headset';
    else if (capability === 'sales') icon = 'fa-handshake';
    else if (capability === 'customer') icon = 'fa-comments-dollar';
    else if (capability === 'openlab') icon = 'fa-flask';
    else if (capability === 'marketing') icon = 'fa-bullhorn';
    else if (capability === 'finance') icon = 'fa-coins';
    else if (capability === 'hr') icon = 'fa-user-group';
    else if (capability === 'analytics') icon = 'fa-chart-pie';

    // Append to grid
    const agentGrid = document.querySelector('.agent-grid-large');
    const creatorCard = document.getElementById('agent-card-creator');

    const card = document.createElement('div');
    card.className = 'agent-card-large active';
    card.innerHTML = `
      <div class="agent-card-large-top">
        <div class="agent-card-large-icon"><i class="fa-solid ${icon}"></i></div>
        <div>
          <div class="agent-card-large-title">${name}</div>
          <div class="agent-card-large-desc">${role}</div>
        </div>
      </div>
      <div class="agent-card-large-bottom">
        <div class="status-indicator">
          <span class="status-dot" style="background:var(--color-success); box-shadow:0 0 6px var(--color-success);"></span>
          <span class="status-text">Active</span>
        </div>
        <label class="switch">
          <input type="checkbox" checked data-agent="${name}">
          <span class="slider"></span>
        </label>
      </div>
    `;

    agentGrid.insertBefore(card, creatorCard);
    bindAgentToggles();
    agentModal.classList.remove('open');
    agentForm.reset();
    logActivity('System', `Deployed new autonomous Custom Agent: ${name}`);
  });

  // -------------------------------------------------------------
  // 5. Suite Catalog Playground Injections
  // -------------------------------------------------------------
  const suiteCatalogView = document.getElementById('suite-catalog-view');
  const suitePlaygroundView = document.getElementById('suite-playground-view');
  const playgroundTitle = document.getElementById('playground-title');
  const playgroundBody = document.getElementById('playground-container-body');
  const backToSuiteBtn = document.getElementById('btn-back-to-suite');

  function showSuiteCatalog() {
    suitePlaygroundView.style.display = 'none';
    suiteCatalogView.style.display = 'block';
  }
  if (backToSuiteBtn) backToSuiteBtn.addEventListener('click', showSuiteCatalog);

  // Playground layouts dataset
  const playgroundLayouts = {
    proposal: {
      title: 'AI Proposal Generator',
      html: `
        <div class="playground-split">
          <div class="playground-form-panel">
            <div class="playground-form-group">
              <label>Client / Company Name</label>
              <input type="text" id="prop-client" placeholder="e.g. Acme Tech Solutions Inc.">
            </div>
            <div class="playground-form-group">
              <label>Project Scope / Deliverables</label>
              <textarea id="prop-scope" rows="3" placeholder="e.g. Design responsive dark dashboard with 6 mock nodes pipeline"></textarea>
            </div>
            <div class="playground-form-group">
              <label>Pricing Model & Budget ($)</label>
              <input type="text" id="prop-budget" placeholder="e.g. $8,500 One-time fee">
            </div>
            <div class="playground-form-group">
              <label>Contract Template</label>
              <select id="prop-template">
                <option value="saas">SaaS Platform Agreement</option>
                <option value="agency">Agency Consulting Contract</option>
                <option value="nd">Non-Disclosure Agreement</option>
              </select>
            </div>
            <button class="btn-primary" id="btn-prop-generate" style="width:100%; justify-content:center;">
              <i class="fa-solid fa-file-signature"></i> Draft Legal Contract
            </button>
          </div>
          <div class="playground-preview-panel" id="prop-preview-pane">
            <div style="text-align:center; color:var(--text-muted);">
              <i class="fa-solid fa-file-invoice" style="font-size:3rem; margin-bottom:12px;"></i>
              <p>Formulate a contract proposal outline on the left to see the drafted document preview.</p>
            </div>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById('btn-prop-generate').addEventListener('click', () => {
          const client = document.getElementById('prop-client').value || 'Target Client';
          const scope = document.getElementById('prop-scope').value || 'Automated data routing workspace development.';
          const budget = document.getElementById('prop-budget').value || '$5,000 fixed price';
          const template = document.getElementById('prop-template').value;
          
          const preview = document.getElementById('prop-preview-pane');
          preview.innerHTML = '<div style="color:var(--color-primary); font-size:1.5rem;"><i class="fa-solid fa-spinner fa-spin"></i> Writing agreement draft...</div>';
          
          setTimeout(() => {
            let templateName = 'SaaS Service Agreement';
            if (template === 'agency') templateName = 'Consulting Terms Contract';
            else if (template === 'nd') templateName = 'NDA Non-Disclosure Agreement';

            preview.innerHTML = `
              <div class="contract-mockup-paper">
                <div class="contract-header">${templateName}</div>
                <p>This Agreement is entered into by and between <strong>NexusHub AI</strong> (hereinafter "Provider") and <strong>${client}</strong> (hereinafter "Client").</p>
                <div class="contract-section-title">1. Deliverable Specifications</div>
                <p>Provider agrees to engineer, compile, and configure the following features: <em>${scope}</em>.</p>
                <div class="contract-section-title">2. Fees & Compensation</div>
                <p>Client agrees to compensate Provider the sum of <strong>${budget}</strong> upon completion and inspection of milestones.</p>
                <div class="contract-section-title">3. Privacy & IP Terms</div>
                <p>All algorithm designs, workspace variables, and model weights developed under this scope remain the intellectual property of the Client.</p>
                <div class="contract-signature-line">
                  <div class="contract-sig-box">NexusHub Representative</div>
                  <div class="contract-sig-box">${client} Manager</div>
                </div>
              </div>
              <button class="btn-primary" style="margin-top:16px; font-size:0.75rem; padding:8px 16px;" onclick="window.logActivity('System', 'Signed proposal generated for ${client}.'); alert('Proposal signed and stored in Workspace database!');">
                <i class="fa-solid fa-check"></i> Sign & Save Contract
              </button>
            `;
            logActivity('Proposal Gen', `Drafted contract proposal for: ${client}`);
          }, 1200);
        });
      }
    },
    resume: {
      title: 'AI Resume Analyzer',
      html: `
        <div class="playground-split">
          <div class="playground-form-panel">
            <div class="playground-form-group">
              <label>Target Job Title</label>
              <input type="text" id="resume-job" placeholder="e.g. Lead Frontend Developer">
            </div>
            <div class="playground-form-group">
              <label>Applicant Resume Text</label>
              <textarea id="resume-text" rows="8" placeholder="Paste applicant resume copy here..."></textarea>
            </div>
            <button class="btn-primary" id="btn-resume-analyze" style="width:100%; justify-content:center;">
              <i class="fa-solid fa-brain"></i> Score & Index Resume
            </button>
          </div>
          <div class="playground-preview-panel" id="resume-preview-pane">
            <div style="text-align:center; color:var(--text-muted);">
              <i class="fa-solid fa-id-card-clip" style="font-size:3rem; margin-bottom:12px;"></i>
              <p>Paste resume profile text to analyze alignment metrics.</p>
            </div>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById('btn-resume-analyze').addEventListener('click', () => {
          const job = document.getElementById('resume-job').value || 'General Position';
          const rText = document.getElementById('resume-text').value;
          const preview = document.getElementById('resume-preview-pane');

          if (!rText.trim()) {
            alert('Please paste resume details first!');
            return;
          }

          preview.innerHTML = '<div style="color:var(--color-primary); font-size:1.5rem;"><i class="fa-solid fa-spinner fa-spin"></i> Parsing candidate details...</div>';
          
          setTimeout(() => {
            const score = Math.floor(Math.random() * 25) + 72; // Score between 72 and 97
            
            preview.innerHTML = `
              <div class="resume-score-ring" style="--score-pct: ${score};">
                <div class="resume-score-value">${score}</div>
              </div>
              <div style="text-align:center; margin-top:16px;">
                <h4 style="color:#fff;">Job Match Alignment: ${score}%</h4>
                <p style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">Target Role: <strong>${job}</strong></p>
              </div>
              <div style="margin-top:20px; text-align:left; width:100%; font-size:0.72rem; display:flex; flex-direction:column; gap:8px;">
                <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:8px; border-left:3px solid var(--color-success);">
                  <strong style="color:var(--color-success);">Match Highlight:</strong> High technical skill density in React, CSS Grid variables, and canvas interactions.
                </div>
                <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:8px; border-left:3px solid var(--color-warning);">
                  <strong style="color:var(--color-warning);">Identified Gap:</strong> Lacks explicit mentions of AWS serverless credentials or Docker routing.
                </div>
              </div>
            `;
            logActivity('HR Agent', `Analyzed resume. Score: ${score}% match for ${job}`);
          }, 1200);
        });
      }
    },
    web: {
      title: 'AI Website Builder',
      html: `
        <div class="playground-split">
          <div class="playground-form-panel">
            <div class="playground-form-group">
              <label>Website Name / Title</label>
              <input type="text" id="web-title" placeholder="e.g. Mercer Cybersecurity Hub">
            </div>
            <div class="playground-form-group">
              <label>Design Style Theme</label>
              <select id="web-theme">
                <option value="cyber">Cybernetic Neon Dark</option>
                <option value="light">Outfit Minimal Bright</option>
                <option value="glass">Translucent Glassmorphism</option>
              </select>
            </div>
            <div class="playground-form-group">
              <label>Core Objective / Keywords</label>
              <input type="text" id="web-purpose" placeholder="e.g. consulting, pricing catalog, book call">
            </div>
            <button class="btn-primary" id="btn-web-generate" style="width:100%; justify-content:center;">
              <i class="fa-solid fa-globe"></i> Compile Website Layout
            </button>
          </div>
          <div class="playground-preview-panel" id="web-preview-pane">
            <div style="text-align:center; color:var(--text-muted);">
              <i class="fa-solid fa-compass-drafting" style="font-size:3rem; margin-bottom:12px;"></i>
              <p>Input website tags to compile a layout preview.</p>
            </div>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById('btn-web-generate').addEventListener('click', () => {
          const title = document.getElementById('web-title').value || 'Mercer Cyber';
          const theme = document.getElementById('web-theme').value;
          const purpose = document.getElementById('web-purpose').value || 'consulting agency';
          const preview = document.getElementById('web-preview-pane');

          preview.innerHTML = '<div style="color:var(--color-primary); font-size:1.5rem;"><i class="fa-solid fa-spinner fa-spin"></i> Writing code blocks & assets...</div>';

          setTimeout(() => {
            let bg = '#0f172a', txt = '#fff', btn = 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)';
            if (theme === 'light') { bg = '#f9fafb'; txt = '#111827'; btn = '#8b5cf6'; }
            else if (theme === 'glass') { bg = 'rgba(15, 23, 42, 0.6)'; txt = '#fff'; btn = 'rgba(255, 255, 255, 0.1)'; }

            preview.innerHTML = `
              <div class="website-preview-browser">
                <div class="browser-titlebar">
                  <span class="browser-dot" style="background:#ef4444;"></span>
                  <span class="browser-dot" style="background:#f59e0b;"></span>
                  <span class="browser-dot" style="background:#10b981;"></span>
                  <div class="browser-address">https://www.mercer-hub.com</div>
                </div>
                <div class="browser-content" style="background:${bg}; color:${txt}; padding: 30px 16px; text-align:center;">
                  <h3 style="font-size:1.4rem; color:${txt};">${title}</h3>
                  <p style="font-size:0.7rem; color:${theme === 'light' ? '#4b5563' : '#9ca3af'}; margin-top:8px;">Highly optimized landing page for ${purpose} services.</p>
                  <button style="margin-top:20px; background:${btn}; color:#fff; border:none; padding:8px 16px; border-radius:20px; font-size:0.65rem; cursor:pointer;">
                    Explore Services
                  </button>
                </div>
              </div>
              <button class="btn-primary" style="margin-top:16px; font-size:0.75rem;" onclick="window.logActivity('System', 'Published website for ${title} to domain.'); alert('Website published successfully!');">
                <i class="fa-solid fa-cloud-arrow-up"></i> Publish Website Live
              </button>
            `;
            logActivity('Web Builder', `Compiled new webpage blueprint: ${title}`);
          }, 1500);
        });
      }
    },
    social: {
      title: 'AI Social Media Suite',
      html: `
        <div class="playground-split">
          <div class="playground-form-panel">
            <div class="playground-form-group">
              <label>Topic / Announcement</label>
              <input type="text" id="social-topic" placeholder="e.g. NexusHub AI release v2.0">
            </div>
            <div class="playground-form-group">
              <label>Tone of Voice</label>
              <select id="social-tone">
                <option value="hype">Excited & High Energy</option>
                <option value="prof">Professional & Strategic</option>
                <option value="casual">Casual & Conversational</option>
              </select>
            </div>
            <button class="btn-primary" id="btn-social-generate" style="width:100%; justify-content:center;">
              <i class="fa-solid fa-hashtag"></i> Generate Post Templates
            </button>
          </div>
          <div class="playground-preview-panel" id="social-preview-pane">
            <div style="text-align:center; color:var(--text-muted);">
              <i class="fa-brands fa-twitter" style="font-size:3rem; margin-bottom:12px;"></i>
              <p>Enter campaign topic details to draft content pages.</p>
            </div>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById('btn-social-generate').addEventListener('click', () => {
          const topic = document.getElementById('social-topic').value || 'NexusHub AI v2.0 launch';
          const tone = document.getElementById('social-tone').value;
          const preview = document.getElementById('social-preview-pane');

          preview.innerHTML = '<div style="color:var(--color-primary); font-size:1.5rem;"><i class="fa-solid fa-spinner fa-spin"></i> Writing draft tweets...</div>';

          setTimeout(() => {
            let p1 = `🚀 BIG NEWS! We just launched NexusHub AI v2.0! Immersive 3D workflows, Google OAuth authentication, and vector-embedded databases are officially live! Check it out! #AI #Tech`;
            let p2 = `Automating SAAS workflows is no longer just for developers. NexusHub AI v2.0 wraps agents, chatbot contexts, and custom trigger nodes into a beautiful 3D deck dashboard. Let us scale your billing now.`;
            
            if (tone === 'prof') {
              p1 = `We are pleased to introduce the deployment of NexusHub AI v2.0. This milestone focuses on robust, low-latency node processing, Google authentication layers, and integrated analytical forecasts.`;
              p2 = `Operational efficiency defines longevity. With v2.0, we present enterprise managers with full-canvas workflow orchestration and vector-backed document queries in a unified SPA interface.`;
            }

            preview.innerHTML = `
              <div style="width:100%; display:flex; flex-direction:column; gap:12px;">
                <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:16px; border-radius:12px; position:relative; text-align:left;">
                  <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    <i class="fa-brands fa-square-x-twitter" style="font-size:1.1rem; color:#fff;"></i>
                    <strong style="font-size:0.75rem; color:#fff;">Template 1 (X/Twitter)</strong>
                  </div>
                  <p style="font-size:0.72rem; color:var(--text-secondary); line-height:1.4;">${p1}</p>
                </div>
                <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:16px; border-radius:12px; position:relative; text-align:left;">
                  <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    <i class="fa-brands fa-linkedin" style="font-size:1.1rem; color:#0a66c2;"></i>
                    <strong style="font-size:0.75rem; color:#fff;">Template 2 (LinkedIn)</strong>
                  </div>
                  <p style="font-size:0.72rem; color:var(--text-secondary); line-height:1.4;">${p2}</p>
                </div>
              </div>
              <button class="btn-primary" style="margin-top:16px; font-size:0.75rem;" onclick="window.logActivity('Marketing Agent', 'Pushed campaign updates directly to X queue.'); alert('Posts scheduled to queues!');">
                <i class="fa-solid fa-calendar-days"></i> Schedule Campaign Queue
              </button>
            `;
            logActivity('Marketing Agent', `Generated post drafts for: ${topic}`);
          }, 1200);
        });
      }
    },
    meeting: {
      title: 'AI Meeting Assistant',
      html: `
        <div class="playground-split">
          <div class="playground-form-panel">
            <div class="playground-form-group">
              <label>Select Mock Meeting Stream</label>
              <select id="meeting-stream">
                <option value="sync">Product Sync Sync v2.0</option>
                <option value="pitch">Client Strategy Proposal call</option>
                <option value="recruit">HR Candidate Interview notes</option>
              </select>
            </div>
            <button class="btn-primary" id="btn-meeting-summarize" style="width:100%; justify-content:center;">
              <i class="fa-solid fa-volume-high"></i> Compile Summary & Action Items
            </button>
          </div>
          <div class="playground-preview-panel" id="meeting-preview-pane">
            <div style="text-align:center; color:var(--text-muted);">
              <i class="fa-solid fa-microphone-slash" style="font-size:3rem; margin-bottom:12px;"></i>
              <p>Select a recorded call stream log to summarize minutes.</p>
            </div>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById('btn-meeting-summarize').addEventListener('click', () => {
          const stream = document.getElementById('meeting-stream').value;
          const preview = document.getElementById('meeting-preview-pane');

          preview.innerHTML = '<div style="color:var(--color-primary); font-size:1.5rem;"><i class="fa-solid fa-spinner fa-spin"></i> Analyzing audio transcript blocks...</div>';

          setTimeout(() => {
            let title = 'Product Sync Notes';
            let summ = 'Discussion focused on finalizing the transition coordinates for the 3D tabs rotates inside the SPA viewport dashboard.';
            let bullet1 = 'Varaprasad: Setup cache-busting arguments (?v=2.2) to prevent old css overlap bugs.';
            let bullet2 = 'Developer Agent: Expose drawConnections functions in workflow.js globally.';

            if (stream === 'pitch') {
              title = 'Client Strategy call';
              summ = 'Aligned on budget allocations ($8,500 fixed) for deploying custom Analytics gauges.';
              bullet1 = 'Sales Agent: Draft official SaaS Partnership proposal documents by Friday.';
              bullet2 = 'Client Manager: Send vector handbook texts context for ingest indexes.';
            } else if (stream === 'recruit') {
              title = 'HR Interview review';
              summ = 'Evaluated candidate background and scored React code templates knowledge.';
              bullet1 = 'HR Agent: Log 92% match score in candidate profile tracker list.';
              bullet2 = 'System: Trigger automated invite links for Stage 2 tech screens.';
            }

            preview.innerHTML = `
              <div style="text-align:left; width:100%; font-size:0.75rem; display:flex; flex-direction:column; gap:12px;">
                <h4 style="color:#fff; border-bottom:1px solid var(--border-color); padding-bottom:6px;">${title} Minutes</h4>
                <p style="color:var(--text-secondary); line-height:1.4;"><strong>Overview:</strong> ${summ}</p>
                <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-color); padding:10px; border-radius:8px;">
                  <strong style="color:var(--color-primary);">Immediate Action Items:</strong>
                  <ul style="margin-top:6px; padding-left:16px; display:flex; flex-direction:column; gap:4px; color:var(--text-secondary);">
                    <li>${bullet1}</li>
                    <li>${bullet2}</li>
                  </ul>
                </div>
              </div>
            `;
            logActivity('System', `Processed sync minutes audio summaries: ${title}`);
          }, 1300);
        });
      }
    },
    interview: {
      title: 'AI Interview Simulator',
      html: `
        <div class="playground-split">
          <div class="playground-form-panel">
            <div class="playground-form-group">
              <label>Select Target Interview Role</label>
              <select id="interview-role">
                <option value="front">Senior React Developer</option>
                <option value="pm">Product Manager (SAAS)</option>
              </select>
            </div>
            <div class="playground-form-group" id="interview-chat-form" style="display:none; gap:10px;">
              <label style="color:#fff;" id="interview-question-label">Question: ...</label>
              <textarea id="interview-answer" rows="3" placeholder="Type candidate answer response here..."></textarea>
              <button class="btn-primary" id="btn-interview-submit-answer" style="font-size:0.72rem; padding:8px 12px;">Submit Answer</button>
            </div>
            <button class="btn-primary" id="btn-interview-start" style="width:100%; justify-content:center;">
              <i class="fa-solid fa-play"></i> Start Practice Session
            </button>
          </div>
          <div class="playground-preview-panel" id="interview-preview-pane">
            <div style="text-align:center; color:var(--text-muted);">
              <i class="fa-solid fa-user-tie" style="font-size:3rem; margin-bottom:12px;"></i>
              <p>Select a job profile role on the left to start simulator questions.</p>
            </div>
          </div>
        </div>
      `,
      bind: () => {
        let currentQuestionIndex = 0;
        let role = '';
        const pmQuestions = [
          "How do you prioritize features when designing a SAAS pricing tier?",
          "Explain a time you managed client resistance to major UI transitions."
        ];
        const frontQuestions = [
          "How do you redraw SVG bezier lines dynamically when elements are dragged in a container?",
          "Explain the performance benefits of critical CSS inline injections."
        ];

        document.getElementById('btn-interview-start').addEventListener('click', () => {
          role = document.getElementById('interview-role').value;
          currentQuestionIndex = 0;
          
          document.getElementById('btn-interview-start').style.display = 'none';
          document.getElementById('interview-chat-form').style.display = 'flex';
          
          askNextQuestion();
        });

        function askNextQuestion() {
          const qList = role === 'pm' ? pmQuestions : frontQuestions;
          if (currentQuestionIndex >= qList.length) {
            // End interview
            document.getElementById('interview-chat-form').style.display = 'none';
            document.getElementById('btn-interview-start').style.display = 'block';
            document.getElementById('btn-interview-start').innerHTML = '<i class="fa-solid fa-rotate-left"></i> Restart Session';
            
            document.getElementById('interview-preview-pane').innerHTML = `
              <div style="text-align:center;">
                <i class="fa-solid fa-circle-check" style="font-size:3rem; color:var(--color-success); margin-bottom:12px;"></i>
                <h4 style="color:#fff;">Practice Session Complete</h4>
                <p style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">Evaluated scores saved to candidate record.</p>
              </div>
            `;
            return;
          }

          document.getElementById('interview-question-label').innerHTML = `<strong>Question ${currentQuestionIndex+1}:</strong> ${qList[currentQuestionIndex]}`;
          document.getElementById('interview-preview-pane').innerHTML = `
            <div style="text-align:left; width:100%; font-size:0.75rem; color:var(--text-secondary);">
              <strong>Simulator:</strong> Question dispatched. Waiting for candidate input reply...
            </div>
          `;
        }

        document.getElementById('btn-interview-submit-answer').addEventListener('click', () => {
          const answer = document.getElementById('interview-answer').value;
          if (!answer.trim()) return;

          document.getElementById('interview-preview-pane').innerHTML = '<div style="color:var(--color-primary); font-size:1.2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Grading answer profile...</div>';

          setTimeout(() => {
            document.getElementById('interview-answer').value = '';
            currentQuestionIndex++;
            
            // Random grade comment
            const scores = [82, 85, 88, 92];
            const chosenScore = scores[Math.floor(Math.random() * scores.length)];

            alert(`Answer graded! Score: ${chosenScore}/100. Feedback added to logs.`);
            askNextQuestion();
          }, 1000);
        });
      }
    },
    market: {
      title: 'AI Market Research',
      html: `
        <div class="playground-split">
          <div class="playground-form-panel">
            <div class="playground-form-group">
              <label>Competitor URL / Company</label>
              <input type="text" id="market-competitor" placeholder="e.g. https://acme-competitor.com">
            </div>
            <div class="playground-form-group">
              <label>Target Region</label>
              <select id="market-region">
                <option value="us">North America (US/CA)</option>
                <option value="eu">Europe (EMEA)</option>
                <option value="apac">Asia Pacific (APAC)</option>
              </select>
            </div>
            <div class="playground-form-group">
              <label>Target Keywords</label>
              <input type="text" id="market-keywords" placeholder="e.g. cloud security, automated workflow">
            </div>
            <button class="btn-primary" id="btn-market-audit" style="width:100%; justify-content:center;">
              <i class="fa-solid fa-magnifying-glass-chart"></i> Audit Competitor Metrics
            </button>
          </div>
          <div class="playground-preview-panel" id="market-preview-pane">
            <div style="text-align:center; color:var(--text-muted);">
              <i class="fa-solid fa-chart-line" style="font-size:3rem; margin-bottom:12px;"></i>
              <p>Enter competitor website data to compile competitive analytics report.</p>
            </div>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById('btn-market-audit').addEventListener('click', () => {
          const comp = document.getElementById('market-competitor').value || 'https://acme-competitor.com';
          const reg = document.getElementById('market-region').value;
          const kw = document.getElementById('market-keywords').value || 'SaaS platform';
          const preview = document.getElementById('market-preview-pane');

          preview.innerHTML = '<div style="color:var(--color-primary); font-size:1.5rem;"><i class="fa-solid fa-spinner fa-spin"></i> Auditing SEO rank & domain authority metrics...</div>';

          setTimeout(() => {
            const domainScore = Math.floor(Math.random() * 30) + 55; // Score 55-85
            const keywordRank = Math.floor(Math.random() * 5) + 2;   // Rank 2-7
            
            preview.innerHTML = `
              <div style="text-align:left; width:100%; font-size:0.75rem; display:flex; flex-direction:column; gap:12px;">
                <h4 style="color:#fff; border-bottom:1px solid var(--border-color); padding-bottom:6px;">Market Research Summary: ${comp}</h4>
                <p style="color:var(--text-secondary); line-height:1.4;"><strong>SEO Analysis:</strong> Domain Authority score evaluated at <strong>${domainScore}/100</strong>. Competitor shows high organic weight in region code <strong>${reg.toUpperCase()}</strong>.</p>
                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); padding:10px; border-radius:8px;">
                  <strong style="color:var(--color-secondary);">Keyword Opportunities:</strong>
                  <ul style="margin-top:6px; padding-left:16px; display:flex; flex-direction:column; gap:4px; color:var(--text-secondary);">
                    <li>Target keyword "${kw}" is ranked #${keywordRank} in organic search.</li>
                    <li>Recommendation: Focus content campaigns on long-tail integrations keyword tags.</li>
                  </ul>
                </div>
              </div>
            `;
            logActivity('Market Research', `Audited domain metrics for competitor: ${comp}`);
          }, 1200);
        });
      }
    },
    openlab: {
      title: 'Open Innovation Lab',
      html: `
        <div class="playground-split">
          <div class="playground-form-panel">
            <div class="playground-form-group">
              <label>Select Base Model</label>
              <select id="lab-model">
                <option value="llama">Llama-3-70B-Instruct</option>
                <option value="mistral">Mistral-Large-v2</option>
                <option value="claude">Claude-3.5-Sonnet</option>
              </select>
            </div>
            <div class="playground-form-group">
              <label>Fine-tuning Dataset</label>
              <select id="lab-dataset">
                <option value="support">Customer Support Logs v1.2</option>
                <option value="sales">Sales Pitch Transcripts v2.0</option>
                <option value="code">React SVG Redraw Snippets</option>
              </select>
            </div>
            <div class="playground-form-group">
              <label>Learning Rate</label>
              <input type="text" id="lab-lr" value="2e-5">
            </div>
            <button class="btn-primary" id="btn-lab-launch" style="width:100%; justify-content:center;">
              <i class="fa-solid fa-flask"></i> Launch Fine-Tuning Session
            </button>
          </div>
          <div class="playground-preview-panel" id="lab-preview-pane">
            <div style="text-align:center; color:var(--text-muted);">
              <i class="fa-solid fa-flask" style="font-size:3rem; margin-bottom:12px;"></i>
              <p>Configure fine-tune hyperparameters to execute training logs simulation.</p>
            </div>
          </div>
        </div>
      `,
      bind: () => {
        document.getElementById('btn-lab-launch').addEventListener('click', () => {
          const model = document.getElementById('lab-model').value;
          const dataset = document.getElementById('lab-dataset').value;
          const lr = document.getElementById('lab-lr').value || '2e-5';
          const preview = document.getElementById('lab-preview-pane');

          preview.innerHTML = '<div style="color:var(--color-primary); font-size:1.2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Initializing model fine-tuning weights...</div>';

          setTimeout(() => {
            preview.innerHTML = `
              <div style="text-align:left; width:100%; font-family:'Courier New', monospace; font-size:0.65rem; background:rgba(0,0,0,0.3); padding:12px; border-radius:8px; display:flex; flex-direction:column; gap:4px; color:#10b981;">
                <div>[SYSTEM] Epoch 1/3: Loss = 1.85, LR = ${lr}</div>
                <div>[SYSTEM] Epoch 2/3: Loss = 1.24, LR = ${lr}</div>
                <div>[SYSTEM] Epoch 3/3: Loss = 0.85, LR = ${lr}</div>
                <div style="color:#fff; margin-top:8px;"><strong>Fine-Tuning Process Complete!</strong></div>
                <div style="color:var(--text-secondary);">Model checkpoints compiled for dataset: ${dataset}</div>
              </div>
            `;
            logActivity('Innovation Lab', `Successfully fine-tuned model checkpoint on ${dataset}`);
          }, 1500);
        });
      }
    }
  };

  // Launch Suite play panel
  function launchPlayground(toolId) {
    const playData = playgroundLayouts[toolId];
    if (!playData) return;

    playgroundTitle.innerText = playData.title;
    playgroundBody.innerHTML = playData.html;
    
    // Toggle displays
    suiteCatalogView.style.display = 'none';
    suitePlaygroundView.style.display = 'flex';
    
    // Bind layouts handlers
    playData.bind();
    logActivity('System', `Launched focused playground: ${playData.title}`);
  }

  // Adjust app.js tool launch triggers to point to playgrounds or redirect tabs
  document.querySelectorAll('.suite-card-large-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const suiteId = btn.dataset.suite;
      e.stopPropagation(); // Stop general modal opens
      if (suiteId === 'chat') {
        switchTab('chat-assistant');
      } else if (suiteId === 'workflow') {
        switchTab('workflow-builder');
      } else if (suiteId === 'kb') {
        switchTab('knowledge-base');
      } else if (suiteId === 'analytics') {
        switchTab('analytics');
      } else if (suiteId === 'web') {
        switchTab('web-builder');
      } else if (suiteId === 'proposal') {
        switchTab('proposal-generator');
      } else if (suiteId === 'resume') {
        switchTab('resume-analyzer');
      } else if (suiteId === 'interview') {
        switchTab('interview-simulator');
      } else if (suiteId === 'openlab') {
        switchTab('open-lab');
      } else if (suiteId === 'meeting') {
        // Mock Meeting modal details
        const infoModal = document.getElementById('info-modal-overlay');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body-content');
        const modalIcon = document.getElementById('modal-icon');
        if (infoModal && modalTitle && modalBody) {
          if (modalIcon) modalIcon.innerHTML = '<i class="fa-solid fa-microphone-slash" style="color:var(--color-primary);"></i>';
          modalTitle.innerText = 'AI Meeting Notes Assistant';
          modalBody.innerHTML = `
            <h4 style="color:#fff; font-size:0.85rem; margin-bottom:8px;">Product Sync Call Notes</h4>
            <p style="font-size:0.75rem; color:var(--text-secondary); line-height:1.45;"><strong>Overview:</strong> Discussion focused on the 15-tab viewport architecture and caching versioning checks.</p>
            <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:8px; margin-top:10px; font-size:0.7rem;">
              <strong style="color:var(--color-secondary);">Action Items:</strong>
              <ul style="margin-top:4px; padding-left:14px;">
                <li>Varaprasad: Setup compliance details modals.</li>
                <li>System: Trigger automated invite links for Stage 2 tech screens.</li>
              </ul>
            </div>
            <button type="button" class="btn-primary" style="margin-top:16px; font-size:0.75rem; padding:8px 16px; width:100%; justify-content:center;" onclick="document.getElementById('info-modal-overlay').classList.remove('open');">Close Assistant</button>
          `;
          infoModal.classList.add('open');
        }
      } else if (suiteId === 'social') {
        // Mock Social modal details
        const infoModal = document.getElementById('info-modal-overlay');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body-content');
        const modalIcon = document.getElementById('modal-icon');
        if (infoModal && modalTitle && modalBody) {
          if (modalIcon) modalIcon.innerHTML = '<i class="fa-solid fa-hashtag" style="color:var(--color-primary);"></i>';
          modalTitle.innerText = 'AI Social Media Suite';
          modalBody.innerHTML = `
            <h4 style="color:#fff; font-size:0.85rem; margin-bottom:8px;">Hype Launch Template</h4>
            <p style="font-size:0.75rem; color:var(--text-secondary); line-height:1.45;">🚀 BIG NEWS! We just launched NexusHub AI v2.4! Immersive 3D workflows and 15 distinct dashboards are officially live! Check it out! #AI #Tech</p>
            <button type="button" class="btn-primary" style="margin-top:16px; font-size:0.75rem; padding:8px 16px; width:100%; justify-content:center;" onclick="document.getElementById('info-modal-overlay').classList.remove('open'); alert('Campaign template scheduled successfully!');">Schedule Campaign</button>
          `;
          infoModal.classList.add('open');
        }
      } else if (suiteId === 'market') {
        // Mock Market modal details
        const infoModal = document.getElementById('info-modal-overlay');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body-content');
        const modalIcon = document.getElementById('modal-icon');
        if (infoModal && modalTitle && modalBody) {
          if (modalIcon) modalIcon.innerHTML = '<i class="fa-solid fa-magnifying-glass-chart" style="color:var(--color-primary);"></i>';
          modalTitle.innerText = 'AI Market Research';
          modalBody.innerHTML = `
            <h4 style="color:#fff; font-size:0.85rem; margin-bottom:8px;">Competitor SEO Audit</h4>
            <p style="font-size:0.75rem; color:var(--text-secondary); line-height:1.45;">Domain Authority score evaluated at <strong>78/100</strong>. High organic rank on keyword "glowing 3D documents".</p>
            <button type="button" class="btn-primary" style="margin-top:16px; font-size:0.75rem; padding:8px 16px; width:100%; justify-content:center;" onclick="document.getElementById('info-modal-overlay').classList.remove('open');">Close Audit</button>
          `;
          infoModal.classList.add('open');
        }
      }
    });
  });

  // Make the entire suite card clickable
  document.querySelectorAll('.suite-card-large').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('suite-card-large-btn') || e.target.closest('.suite-card-large-btn')) return;
      const btn = card.querySelector('.suite-card-large-btn');
      if (btn) btn.click();
    });
    card.style.cursor = 'pointer';
  });

  // -------------------------------------------------------------
  // 6. Immersive Dashboard Navigation Links & Explore Modals
  // -------------------------------------------------------------
  
  // A. Explore buttons click handlers
  const exploreAllFeaturesBtn = document.getElementById('btn-explore-all-features');
  if (exploreAllFeaturesBtn) {
    exploreAllFeaturesBtn.addEventListener('click', () => {
      switchTab('advanced-features');
    });
  }

  const exploreAllAgentsBtn = document.getElementById('btn-explore-all-agents');
  if (exploreAllAgentsBtn) {
    exploreAllAgentsBtn.addEventListener('click', () => {
      const infoModal = document.getElementById('info-modal-overlay');
      const modalTitle = document.getElementById('modal-title');
      const modalBody = document.getElementById('modal-body-content');
      const modalIcon = document.getElementById('modal-icon');
      
      if (infoModal && modalTitle && modalBody) {
        if (modalIcon) modalIcon.innerHTML = '<i class="fa-solid fa-users-gear" style="color:var(--color-primary);"></i>';
        modalTitle.innerText = 'Enterprise AI Agent Registry';
        modalBody.innerHTML = `
          <p style="margin-bottom:12px; font-size:0.8rem; color:var(--text-secondary);">Here is the directory of all operational autonomous agents configured in your workspace.</p>
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.75rem; text-align:left; color:var(--text-primary);">
              <thead>
                <tr style="border-bottom:1.5px solid var(--border-color); color:var(--text-secondary);">
                  <th style="padding:8px 4px;">Agent Class</th>
                  <th style="padding:8px 4px;">Core Objective</th>
                  <th style="padding:8px 4px;">Status</th>
                  <th style="padding:8px 4px;">Billing SLA</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                  <td style="padding:8px 4px;"><strong>Support Agent</strong></td>
                  <td style="padding:8px 4px;">Auto replies billing queues</td>
                  <td style="padding:8px 4px; color:var(--color-success);">DEPLOYED</td>
                  <td style="padding:8px 4px;">Unlimited Free</td>
                </tr>
                <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                  <td style="padding:8px 4px;"><strong>Sales Agent</strong></td>
                  <td style="padding:8px 4px;">Lead identification scraper</td>
                  <td style="padding:8px 4px; color:var(--color-success);">DEPLOYED</td>
                  <td style="padding:8px 4px;">Unlimited Free</td>
                </tr>
                <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                  <td style="padding:8px 4px;"><strong>Marketing Agent</strong></td>
                  <td style="padding:8px 4px;">Social campaign publisher</td>
                  <td style="padding:8px 4px; color:var(--color-success);">DEPLOYED</td>
                  <td style="padding:8px 4px;">Unlimited Free</td>
                </tr>
                <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                  <td style="padding:8px 4px;"><strong>Finance Agent</strong></td>
                  <td style="padding:8px 4px;">Invoice generator parser</td>
                  <td style="padding:8px 4px; color:var(--color-success);">DEPLOYED</td>
                  <td style="padding:8px 4px;">Unlimited Free</td>
                </tr>
                <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                  <td style="padding:8px 4px;"><strong>HR Agent</strong></td>
                  <td style="padding:8px 4px;">Resume skills scoring nodes</td>
                  <td style="padding:8px 4px; color:var(--color-success);">DEPLOYED</td>
                  <td style="padding:8px 4px;">Unlimited Free</td>
                </tr>
                <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                  <td style="padding:8px 4px;"><strong>Analytics Agent</strong></td>
                  <td style="padding:8px 4px;">Revenue logs and trend gauges</td>
                  <td style="padding:8px 4px; color:var(--color-success);">DEPLOYED</td>
                  <td style="padding:8px 4px;">Unlimited Free</td>
                </tr>
                <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                  <td style="padding:8px 4px;"><strong>Risk Detector Agent</strong></td>
                  <td style="padding:8px 4px;">Audit third party webhook routes</td>
                  <td style="padding:8px 4px; color:var(--color-secondary);">STANDBY</td>
                  <td style="padding:8px 4px;">Unlimited Free</td>
                </tr>
              </tbody>
            </table>
          </div>
          <button type="button" class="btn-primary" style="margin-top:16px; font-size:0.75rem; padding:8px 16px; width:100%; justify-content:center;" onclick="document.getElementById('info-modal-overlay').classList.remove('open');">Close Registry</button>
        `;
        infoModal.classList.add('open');
      }
    });
  }

  // B. Clickable Recent Activity Log Routing
  if (activityLogger) {
    activityLogger.addEventListener('click', (e) => {
      const item = e.target.closest('.activity-item');
      if (!item) return;
      const text = item.innerText || '';
      
      if (text.includes('Support') || text.includes('ticket')) {
        switchTab('chat-assistant');
      } else if (text.includes('Workflow') || text.includes('automation') || text.includes('pipeline')) {
        switchTab('workflow-builder');
      } else if (text.includes('Invoice') || text.includes('proposal') || text.includes('Drafted contract')) {
        switchTab('proposal-generator');
      } else if (text.includes('Resume') || text.includes('candidate') || text.includes('HR')) {
        switchTab('resume-analyzer');
      } else if (text.includes('lead') || text.includes('Sales') || text.includes('competitor')) {
        switchTab('analytics');
      } else if (text.includes('vectorized') || text.includes('indexing') || text.includes('ingested') || text.includes('Knowledge Base')) {
        switchTab('knowledge-base');
      } else {
        switchTab('command-center');
      }
    });
    activityLogger.style.cursor = 'pointer';
  }

  // C. AI Chat Assistant Live Controls
  const chatSendBtn = document.getElementById('chat-send-btn');
  const chatUserInput = document.getElementById('chat-user-input');
  const chatMessagesContainer = document.getElementById('chat-messages-container');
  const chatSuggestionsArea = document.getElementById('chat-suggestions-area');
  const chatVoiceBtn = document.getElementById('chat-voice-btn');
  const chatAttachmentBtn = document.getElementById('chat-attachment-btn');
  const chatFileInput = document.getElementById('chat-file-input');
  const chatSelectedFileBadge = document.getElementById('chat-selected-file-badge');
  const chatSelectedFileName = document.getElementById('chat-selected-file-name');
  const chatSelectedFileRemove = document.getElementById('chat-selected-file-remove');

  // Sidebar badges selectors
  const badgeVoice = document.getElementById('cap-voice');
  const badgeUpload = document.getElementById('cap-upload');
  const badgeSearch = document.getElementById('cap-search');
  const badgeLang = document.getElementById('cap-lang');

  let chatSearchMode = false;
  let chatLangMode = false;
  let chatVoiceMode = false;
  let chatStagedFile = null;

  // Render language selector when active
  let chatLangSelector = null;

  if (badgeSearch) {
    badgeSearch.addEventListener('click', () => {
      chatSearchMode = !chatSearchMode;
      badgeSearch.classList.toggle('active', chatSearchMode);
      logActivity('Chat Assistant', `Web search toggle state: ${chatSearchMode}`);
    });
  }

  if (badgeLang) {
    badgeLang.addEventListener('click', () => {
      chatLangMode = !chatLangMode;
      badgeLang.classList.toggle('active', chatLangMode);
      
      const wrapper = document.querySelector('.chat-input-wrapper');
      if (chatLangMode) {
        chatLangSelector = document.createElement('select');
        chatLangSelector.id = 'chat-lang-selector';
        chatLangSelector.style.cssText = 'padding: 6px; border-radius: 6px; font-size: 0.65rem; background: #121826; border: 1px solid var(--border-color); color: #fff; outline:none; margin-right: 6px;';
        chatLangSelector.innerHTML = `
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="te">Telugu</option>
          <option value="de">German</option>
        `;
        wrapper.insertBefore(chatLangSelector, chatUserInput);
      } else {
        if (chatLangSelector) {
          chatLangSelector.remove();
          chatLangSelector = null;
        }
      }
      logActivity('Chat Assistant', `Language translation mode state: ${chatLangMode}`);
    });
  }

  if (badgeVoice) {
    badgeVoice.addEventListener('click', () => {
      chatVoiceMode = !chatVoiceMode;
      badgeVoice.classList.toggle('active', chatVoiceMode);
      logActivity('Chat Assistant', `Speech interface mode state: ${chatVoiceMode}`);
    });
  }

  if (badgeUpload) {
    badgeUpload.addEventListener('click', () => {
      if (chatAttachmentBtn) chatAttachmentBtn.click();
    });
  }

  // File attachments handlers
  if (chatAttachmentBtn && chatFileInput) {
    chatAttachmentBtn.addEventListener('click', () => {
      chatFileInput.click();
    });

    chatFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 50 * 1024 * 1024) {
          alert('Upload rejected: Maximum allowed chat attachment size is 50MB.');
          return;
        }
        
        chatStagedFile = {
          name: file.name,
          size: file.size,
          type: file.name.split('.').pop().toLowerCase()
        };

        if (chatStagedFile.type === 'txt' || chatStagedFile.type === 'csv') {
          const reader = new FileReader();
          reader.onload = function(evt) {
            chatStagedFile.content = evt.target.result;
          };
          reader.readAsText(file);
        } else {
          chatStagedFile.content = `Simulated context parsing for ${file.name}.`;
        }

        if (chatSelectedFileName && chatSelectedFileBadge) {
          chatSelectedFileName.innerText = file.name.substring(0, 12) + (file.name.length > 12 ? '...' : '');
          chatSelectedFileBadge.style.display = 'inline-flex';
        }
        if (badgeUpload) badgeUpload.classList.add('active');
        logActivity('Chat Assistant', `Staged document context attachment: ${file.name}`);
      }
    });
  }

  if (chatSelectedFileRemove) {
    chatSelectedFileRemove.addEventListener('click', (e) => {
      e.stopPropagation();
      chatStagedFile = null;
      if (chatFileInput) chatFileInput.value = '';
      if (chatSelectedFileBadge) chatSelectedFileBadge.style.display = 'none';
      if (badgeUpload) badgeUpload.classList.remove('active');
      logActivity('Chat Assistant', 'Cleared staged chat context document.');
    });
  }

  function appendChatMessage(sender, text) {
    if (!chatMessagesContainer) return;
    const msgEl = document.createElement('div');
    msgEl.className = `chat-msg ${sender === 'bot' ? 'bot' : 'user'}`;
    
    let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    msgEl.innerHTML = formattedText;
    
    chatMessagesContainer.appendChild(msgEl);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  }
  window.appendChatMessage = appendChatMessage;

  function translateReply(text, lang) {
    const translations = {
      es: {
        "Here are your top performing products this month:": "Aquí están sus productos de mejor rendimiento este mes:",
        "Checking agents database status...": "Comprobando el estado de la base de datos de agentes...",
        "I've drafted a legal contract template for Acme Solutions.": "He redactado una plantilla de contrato legal para Acme Solutions.",
        "Based on indexed knowledge sources": "Basado en fuentes de conocimiento indexadas",
        "Cross-referencing spreadsheet records": "Registros de hojas de cálculo de referencias cruzadas"
      },
      fr: {
        "Here are your top performing products this month:": "Voici vos produits les plus performants ce mois-ci:",
        "Checking agents database status...": "Vérification de l'état de la base de données des agents...",
        "I've drafted a legal contract template for Acme Solutions.": "J'ai rédigé un modèle de contrat légal pour Acme Solutions.",
        "Based on indexed knowledge sources": "Basé sur des sources de connaissances indexées",
        "Cross-referencing spreadsheet records": "Croisement des enregistrements de feuilles de calcul"
      },
      te: {
        "Here are your top performing products this month:": "ఈ నెలలో మీ అగ్ర పనితీరు కనబరిచిన ఉత్పత్తులు ఇక్కడ ఉన్నాయి:",
        "Checking agents database status...": "ఏజెంట్ల డేటాబేస్ స్థితిని తనిఖీ చేస్తోంది...",
        "I've drafted a legal contract template for Acme Solutions.": "నేను ఆక్మే సొల్యూషన్స్ కోసం చట్టపరమైన ఒప్పంద టెంప్లేట్‌ను రూపొందించాను.",
        "Based on indexed knowledge sources": "ఇండెక్స్ చేయబడిన జ్ఞాన వనరుల ఆధారంగా",
        "Cross-referencing spreadsheet records": "స్ప్రెడ్‌షీట్ రికార్డులను క్రాస్-రెఫరెన్స్ చేయడం"
      },
      de: {
        "Here are your top performing products this month:": "Hier sind Ihre Produkte mit der besten Performance in diesem Monat:",
        "Checking agents database status...": "Überprüfung des Agentendatenbank-Status...",
        "I've drafted a legal contract template for Acme Solutions.": "Ich habe einen Entwurf für einen rechtlichen Vertrag für Acme Solutions erstellt.",
        "Based on indexed knowledge sources": "Basierend auf indizierten Wissensquellen",
        "Cross-referencing spreadsheet records": "Querverweis auf Tabellenkalkulations-Datensätze"
      }
    };
    const dict = translations[lang];
    if (!dict) return text;
    for (const [en, tr] of Object.entries(dict)) {
      if (text.includes(en)) {
        return tr + `<br><span style="font-size:0.6rem; color:var(--text-muted); display:block; margin-top:4px;">(Translated: ${text})</span>`;
      }
    }
    if (lang === 'es') return `[Traducido] ${text}`;
    if (lang === 'fr') return `[Traduit] ${text}`;
    if (lang === 'te') return `[తెలుగు] ${text}`;
    if (lang === 'de') return `[Übersetzt] ${text}`;
    return text;
  }

  function handleChatSend() {
    if (!chatUserInput || !chatMessagesContainer) return;
    let text = chatUserInput.value.trim();
    if (!text) return;
    
    let displayUserText = text;
    if (chatStagedFile) {
      displayUserText = `<i class="fa-solid fa-file" style="color:var(--color-primary); margin-right:4px;"></i> <strong>[Attached: ${chatStagedFile.name}]</strong> ${text}`;
    }
    
    appendChatMessage('user', displayUserText);
    chatUserInput.value = '';
    
    const typingEl = document.createElement('div');
    typingEl.className = 'chat-msg bot typing-indicator-msg';
    typingEl.innerHTML = '<i class="fa-solid fa-ellipsis fa-bounce"></i> Thinking...';
    chatMessagesContainer.appendChild(typingEl);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    
    let searchDelay = 0;
    if (chatSearchMode) {
      searchDelay = 1800;
      setTimeout(() => {
        if (typingEl) {
          typingEl.innerHTML = `🔍 Searching Bing & Google indices for "${text}"...`;
        }
      }, 400);
      setTimeout(() => {
        if (typingEl) {
          typingEl.innerHTML = `🌐 Parsing competitor logs and knowledge vector pages...`;
        }
      }, 1000);
      setTimeout(() => {
        if (typingEl) {
          typingEl.innerHTML = `<i class="fa-solid fa-ellipsis fa-bounce"></i> Resolving final query response...`;
        }
      }, 1500);
    }

    setTimeout(() => {
      typingEl.remove();
      
      let reply = "I have logged your request. Let me know if you would like me to trigger any automation or check platform metrics.";
      const lower = text.toLowerCase();
      
      // Document Q&A inside chat if a file is staged
      if (chatStagedFile && chatStagedFile.content) {
        const fileContentLower = chatStagedFile.content.toLowerCase();
        // Check if query is found inside file
        let fileMatch = false;
        const words = lower.split(/\s+/).filter(w => w.length > 3);
        for (const w of words) {
          if (fileContentLower.includes(w)) {
            const idx = fileContentLower.indexOf(w);
            const start = Math.max(0, idx - 40);
            const end = Math.min(chatStagedFile.content.length, idx + 80);
            reply = `🤖 **Answer matching attached document "${chatStagedFile.name}":** ...${chatStagedFile.content.substring(start, end).trim()}...`;
            fileMatch = true;
            break;
          }
        }
        if (!fileMatch) {
          reply = `🤖 **Document parsed (${chatStagedFile.name}):** Staged document contains ${chatStagedFile.content.length} characters, but no explicit sentence match for "${text}" was found. Using standard model checkpoints.`;
        }
      } else {
        if (lower.includes('products') || lower.includes('top performing')) {
          reply = "Here are your top performing products this month:<br>1. **AI Productivity Suite** (+28.4%)<br>2. **Workflow Automation** (+15.2%)<br>3. **Business Analytics Pro** (+12.5%)";
        } else if (lower.includes('agent') || lower.includes('agents status') || lower.includes('active agents')) {
          reply = "Checking agents database status... All 6 agents are currently active and listening to events. Sales Agent recently scored candidate Mercer (Qualification match 92%).";
        } else if (lower.includes('proposal') || lower.includes('contract')) {
          reply = "I've drafted a legal contract template for Acme Solutions. You can view or sign it in the All-in-One AI Suite tab under the **Proposal Generator** playground.";
        } else if (lower.includes('remote') || lower.includes('work') || lower.includes('policy')) {
          reply = "Based on indexed knowledge sources (Company Handbook.pdf): Full-time employees can coordinate up to 2 days of remote work weekly. Core hours are 10 AM to 4 PM.";
        } else if (lower.includes('sales target') || lower.includes('q1')) {
          reply = "Cross-referencing spreadsheet records: Q1 Sales targets aggregate is set to **$150,000**, with month-over-month growth benchmarked at **12%**.";
        } else if (chatSearchMode) {
          reply = `🌐 **Live Web Search results for "${text}":** Found top references on Google. The current market rates align with AI custom agents development costs estimated between $5k-$20k. Web crawling completed successfully.`;
        }
      }
      
      // Auto-translate if language mode is active or configured in settings
      const settingsLang = safeStorage.getItem('settings_translation_lang') || 'none';
      if (chatLangMode && chatLangSelector) {
        reply = translateReply(reply, chatLangSelector.value);
      } else if (settingsLang !== 'none') {
        reply = translateReply(reply, settingsLang);
      }
      
      appendChatMessage('bot', reply);
      
      // Clear staged file after send to prevent sticky attachments
      if (chatStagedFile) {
        chatSelectedFileRemove.click();
      }
    }, 1000 + searchDelay);
  }
  
  if (chatSendBtn) {
    chatSendBtn.addEventListener('click', handleChatSend);
  }
  if (chatUserInput) {
    chatUserInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleChatSend();
    });
  }
  
  if (chatSuggestionsArea) {
    chatSuggestionsArea.addEventListener('click', (e) => {
      const pill = e.target.closest('.suggestion-pill');
      if (!pill) return;
      const text = pill.dataset.query || pill.innerText;
      if (chatUserInput) {
        chatUserInput.value = text;
        handleChatSend();
      }
    });
  }

  // Web Speech API Voice Dictation Input
  if (chatVoiceBtn) {
    chatVoiceBtn.addEventListener('click', () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = function() {
          chatVoiceBtn.style.color = 'var(--color-danger)';
          if (chatUserInput) chatUserInput.placeholder = 'Listening... Speak clearly now.';
          if (badgeVoice) badgeVoice.classList.add('active');
        };

        recognition.onerror = function(event) {
          console.warn("Speech recognition error:", event.error);
          chatVoiceBtn.style.color = '';
          if (chatUserInput) chatUserInput.placeholder = 'Type your message here...';
          if (badgeVoice) badgeVoice.classList.remove('active');
        };

        recognition.onend = function() {
          chatVoiceBtn.style.color = '';
          if (chatUserInput) chatUserInput.placeholder = 'Type your message here...';
          if (badgeVoice) badgeVoice.classList.remove('active');
        };

        recognition.onresult = function(event) {
          const resultText = event.results[0][0].transcript;
          if (chatUserInput) {
            chatUserInput.value = resultText;
            handleChatSend();
          }
        };

        recognition.start();
      } else {
        // Fallback simulated dictation
        if (chatUserInput) {
          chatUserInput.value = 'Analyzing audio stream... Please speak now.';
          chatVoiceBtn.style.color = 'var(--color-danger)';
          setTimeout(() => {
            chatUserInput.value = 'Show me active agents status.';
            chatVoiceBtn.style.color = '';
            handleChatSend();
          }, 1800);
        }
      }
    });
  }

  // -------------------------------------------------------------
  // 7. General Navigation Page Load restoration (Google OAuth)
  // -------------------------------------------------------------
  const chartData = {
    month: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      data: [35000, 48000, 41000, 56300],
      stats: {
        revenue: '$124,563',
        customers: '2,345',
        leads: '1,234',
        tasks: '856',
        interactions: '45,231'
      }
    },
    week: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      data: [8000, 9500, 11000, 8500, 12000, 7000, 6500],
      stats: {
        revenue: '$31,450',
        customers: '562',
        leads: '341',
        tasks: '198',
        interactions: '9,842'
      }
    },
    today: {
      labels: ['9 AM', '12 PM', '3 PM', '6 PM', '9 PM'],
      data: [1200, 2500, 3100, 1800, 900],
      stats: {
        revenue: '$9,500',
        customers: '143',
        leads: '64',
        tasks: '48',
        interactions: '2,105'
      }
    }
  };

  let mainRevenueChart = null;
  let salesPerfChart = null;
  let sentimentChart = null;
  let leadConvChart = null;
  let supportResChart = null;
  let trafficSourceChart = null;
  let activeTimeframe = 'month';

  function initRevenueChart(timeframe) {
    if (typeof Chart === 'undefined') {
      console.warn("ChartJS library not loaded. Spline chart bypassed.");
      return;
    }
    const currentData = chartData[timeframe];
    const revCanvas = document.getElementById('revenueSplineChart');
    if (!revCanvas) return;
    
    if (mainRevenueChart) mainRevenueChart.destroy();
    
    const ctx = revCanvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0.0)');

    mainRevenueChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: currentData.labels,
        datasets: [{
          data: currentData.data,
          borderColor: '#8b5cf6',
          borderWidth: 3,
          pointBackgroundColor: '#8b5cf6',
          pointBorderColor: '#ffffff',
          tension: 0.4,
          fill: true,
          backgroundColor: gradient
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255, 255, 255, 0.03)' } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.03)' } }
        }
      }
    });
  }

  function initAnalyticsCharts() {
    if (typeof Chart === 'undefined') {
      console.warn("ChartJS library not loaded. Analytics mini-charts bypassed.");
      return;
    }
    const salesCanvas = document.getElementById('salesPerfMiniChart');
    const sentimentCanvas = document.getElementById('sentimentMiniChart');
    const leadCanvas = document.getElementById('leadConvMiniChart');
    const supportCanvas = document.getElementById('supportResMiniChart');

    // Sales Performance Line Chart
    if (salesCanvas) {
      if (salesPerfChart) salesPerfChart.destroy();
      salesPerfChart = new Chart(salesCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: ['W1', 'W2', 'W3', 'W4'],
          datasets: [{
            data: [12000, 19000, 15000, 25000],
            borderColor: '#10b981',
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.4,
            fill: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 8 } } },
            y: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { font: { size: 8 } } }
          }
        }
      });
    }

    // Customer Sentiment Doughnut Chart
    if (sentimentCanvas) {
      if (sentimentChart) sentimentChart.destroy();
      sentimentChart = new Chart(sentimentCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['Positive', 'Neutral', 'Negative'],
          datasets: [{
            data: [70, 20, 10],
            backgroundColor: ['#10b981', '#6b7280', '#ef4444'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          cutout: '70%'
        }
      });
    }

    // Lead Conversion Line Chart
    if (leadCanvas) {
      if (leadConvChart) leadConvChart.destroy();
      leadConvChart = new Chart(leadCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: ['W1', 'W2', 'W3', 'W4'],
          datasets: [{
            data: [8, 12, 14, 18.4],
            borderColor: '#3b82f6',
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.4,
            fill: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 8 } } },
            y: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { font: { size: 8 } } }
          }
        }
      });
    }

    // Support Resolution Uptime Line Chart
    if (supportCanvas) {
      if (supportResChart) supportResChart.destroy();
      supportResChart = new Chart(supportCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: ['W1', 'W2', 'W3', 'W4'],
          datasets: [{
            data: [98.2, 98.9, 99.0, 99.1],
            borderColor: '#8b5cf6',
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.4,
            fill: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 8 } } },
            y: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { font: { size: 8 } } }
          }
        }
      });
    }

    // Traffic Source Bar Chart
    const trafficCanvas = document.getElementById('trafficSourceMiniChart');
    if (trafficCanvas) {
      if (trafficSourceChart) trafficSourceChart.destroy();
      trafficSourceChart = new Chart(trafficCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['Organic Search', 'Direct', 'Referral', 'Social', 'Email', 'Paid Search'],
          datasets: [{
            data: [42, 28, 12, 8, 6, 4],
            backgroundColor: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#6366f1'],
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 8 }, color: '#9ca3af' } },
            y: { grid: { color: 'rgba(255, 255, 255, 0.03)' }, ticks: { font: { size: 8 }, color: '#9ca3af' } }
          }
        }
      });
    }
  }

  function initAllCharts() {
    initRevenueChart(activeTimeframe);
    initAnalyticsCharts();
  }

  // Pre-load default values in DOM before login to match screen indicators
  const defaultData = chartData.month;
  const statsElements = {
    '#stat-revenue .value': defaultData.stats.revenue,
    '#stat-customers .value': defaultData.stats.customers,
    '#stat-leads .value': defaultData.stats.leads,
    '#stat-tasks .value': defaultData.stats.tasks,
    '#stat-interactions .value': defaultData.stats.interactions
  };
  Object.keys(statsElements).forEach(selector => {
    const el = document.querySelector(selector);
    if (el) el.innerText = statsElements[selector];
  });

  const timeframeSelect = document.getElementById('command-timeframe');
  if (timeframeSelect) {
    timeframeSelect.addEventListener('change', (e) => {
      activeTimeframe = e.target.value;
      initRevenueChart(activeTimeframe);
      
      const currentData = chartData[activeTimeframe];
      const selectedStats = {
        '#stat-revenue .value': currentData.stats.revenue,
        '#stat-customers .value': currentData.stats.customers,
        '#stat-leads .value': currentData.stats.leads,
        '#stat-tasks .value': currentData.stats.tasks,
        '#stat-interactions .value': currentData.stats.interactions
      };
      Object.keys(selectedStats).forEach(selector => {
        const el = document.querySelector(selector);
        if (el) el.innerText = selectedStats[selector];
      });
    });
  }

  // -------------------------------------------------------------
  // 6.5. Knowledge Base (KB) Document Processing & Search
  // -------------------------------------------------------------
  const kbDropzone = document.getElementById('kb-upload-dropzone');
  const kbFileInput = document.getElementById('kb-file-input');
  const kbBrowseBtn = document.getElementById('btn-kb-browse');
  const kbProgressBox = document.getElementById('kb-progress-box');
  const kbProgressFilename = document.getElementById('kb-progress-filename');
  const kbProgressPct = document.getElementById('kb-progress-pct');
  const kbProgressBar = document.getElementById('kb-progress-bar');
  const kbDocsUl = document.getElementById('kb-docs-ul');
  
  const kbQueryInput = document.getElementById('kb-query-input');
  const kbQueryBtn = document.getElementById('btn-kb-query');
  const kbQueryResponse = document.getElementById('kb-query-response');

  // Local document registry for real keyword matching Q&A
  window.kbInjectedDocs = [
    { name: "Company Handbook.pdf", content: "Employees are permitted to coordinate up to 2 days of remote work per calendar week. Core office hours are 10 AM to 4 PM.", size: 2400000 },
    { name: "Product Strategy.docx", content: "Our SaaS product strategy focuses on low-latency workflow grids, AI-driven billing pipelines, and visual integrations.", size: 1800000 },
    { name: "Training Guide.pptx", content: "Training schedules are updated monthly. The standard onboarding SLA requires 10 modules completed in the first week.", size: 4100000 }
  ];

  // Trigger file dialog
  if (kbBrowseBtn && kbFileInput) {
    kbBrowseBtn.addEventListener('click', () => {
      kbFileInput.click();
    });
  }

  // Handle file selection
  if (kbFileInput) {
    kbFileInput.addEventListener('change', (e) => {
      handleKbFiles(e.target.files);
    });
  }

  // Drag & drop handlers
  if (kbDropzone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      kbDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        kbDropzone.classList.add('drag-over');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      kbDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        kbDropzone.classList.remove('drag-over');
      }, false);
    });

    kbDropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      handleKbFiles(files);
    });
  }

  function handleKbFiles(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    
    // File size validation: check if file > 50MB (50 * 1024 * 1024)
    if (file.size > 50 * 1024 * 1024) {
      alert(`Upload rejected: "${file.name}" is ${((file.size)/(1024*1024)).toFixed(1)}MB. Maximum allowed size is 50MB.`);
      return;
    }
    
    // Show progress bar
    if (kbProgressBox && kbProgressFilename && kbProgressPct && kbProgressBar) {
      kbProgressBox.style.display = 'flex';
      kbProgressFilename.innerText = `Indexing: ${file.name}`;
      kbProgressPct.innerText = '0%';
      kbProgressBar.style.width = '0%';

      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        kbProgressPct.innerText = `${progress}%`;
        kbProgressBar.style.width = `${progress}%`;

        if (progress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            kbProgressBox.style.display = 'none';
            // Parse text content of uploaded file if txt or csv
            const lowerName = file.name.toLowerCase();
            if (lowerName.endsWith('.txt')) {
              const reader = new FileReader();
              reader.onload = function(e) {
                window.kbInjectedDocs.push({
                  name: file.name,
                  content: e.target.result,
                  size: file.size
                });
                addIndexedDocument(file.name, file.size);
              };
              reader.readAsText(file);
            } else if (lowerName.endsWith('.csv')) {
              const reader = new FileReader();
              reader.onload = function(e) {
                const text = e.target.result;
                const lines = text.split('\n');
                let formattedText = `CSV Sheet Ingestion: ${file.name}.\n`;
                lines.forEach((line, idx) => {
                  if (line.trim()) {
                    formattedText += `Row ${idx + 1}: ${line.split(',').join(' | ')}.\n`;
                  }
                });
                window.kbInjectedDocs.push({
                  name: file.name,
                  content: formattedText,
                  size: file.size
                });
                addIndexedDocument(file.name, file.size);
              };
              reader.readAsText(file);
            } else {
              // Binary files (PDF, Word, Excel) metadata indexes compilation
              let typeLabel = "document";
              let details = "Contains general specifications, project checklists, and platform credentials details.";
              if (lowerName.endsWith('.pdf')) {
                typeLabel = "PDF Document";
                details = `Highlights: Section 1 defines employee guidelines and security configurations. Section 2 lists automated workflows. Reference metrics check values: 99.9% uptime target, target customer conversions rate is 85%.`;
              } else if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
                typeLabel = "Word Document";
                details = `Highlights: Scope of deliverables document. Setup 15 tab commands viewport. Project timeline milestone is set to Q3 launch, total budget matches $8,500 consulting agreement.`;
              } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
                typeLabel = "Excel Spreadsheet";
                details = `Highlights: Financial ledger sheet. Q1 Target: $150,000. January revenue matches $35,000, February shows $48,000, March is $41,000. Margin computed at 32%.`;
              }
              
              window.kbInjectedDocs.push({
                name: file.name,
                content: `Indexed ${typeLabel} file context for ${file.name}. Size properties: ${file.size} bytes. Context content details: ${details}`,
                size: file.size
              });
              addIndexedDocument(file.name, file.size);
            }
          }, 400);
        }
      }, 80);
    }
  }

  function addIndexedDocument(name, sizeBytes) {
    if (!kbDocsUl) return;

    // Convert bytes to formatted string
    let sizeStr = '500 KB';
    if (sizeBytes) {
      if (sizeBytes > 1024 * 1024) {
        sizeStr = `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
      } else {
        sizeStr = `${(sizeBytes / 1024).toFixed(0)} KB`;
      }
    }

    const li = document.createElement('li');
    li.className = 'kb-doc-item';
    
    let iconClass = 'fa-file-pdf';
    let iconColor = '#ef4444';
    if (name.endsWith('.csv')) {
      iconClass = 'fa-file-csv';
      iconColor = '#10b981';
    } else if (name.endsWith('.docx') || name.endsWith('.doc')) {
      iconClass = 'fa-file-word';
      iconColor = '#3b82f6';
    } else if (name.endsWith('.txt')) {
      iconClass = 'fa-file-lines';
      iconColor = '#9ca3af';
    } else if (name.match(/\.(jpeg|jpg|gif|png)$/i)) {
      iconClass = 'fa-file-image';
      iconColor = '#ec4899';
    }

    li.innerHTML = `
      <div class="kb-doc-info">
        <i class="fa-solid ${iconClass}" style="color: ${iconColor};"></i>
        <div>
          <span class="kb-doc-name" title="${name}">${name}</span>
          <span class="kb-doc-meta">${sizeStr} • Just indexed</span>
        </div>
      </div>
      <button type="button" class="kb-doc-delete-btn" data-doc="${name}"><i class="fa-solid fa-trash"></i></button>
    `;

    kbDocsUl.appendChild(li);
    bindKbDeleteBtns();
    
    logActivity('Knowledge Base', `Successfully ingested and vectorized document: ${name}`);
  }

  function bindKbDeleteBtns() {
    document.querySelectorAll('.kb-doc-delete-btn').forEach(btn => {
      btn.removeEventListener('click', deleteKbDoc);
      btn.addEventListener('click', deleteKbDoc);
    });
  }

  function deleteKbDoc(e) {
    const btn = e.currentTarget;
    const docName = btn.dataset.doc;
    const item = btn.closest('.kb-doc-item');
    if (item) {
      item.remove();
      window.kbInjectedDocs = window.kbInjectedDocs.filter(d => d.name !== docName);
      logActivity('Knowledge Base', `De-indexed and removed document: ${docName}`);
    }
  }

  // Bind initial delete buttons
  bindKbDeleteBtns();

  // Semantic query search
  function runKbQuery() {
    if (!kbQueryInput || !kbQueryResponse) return;
    const query = kbQueryInput.value.trim();
    if (!query) return;

    kbQueryResponse.style.display = 'block';
    kbQueryResponse.innerHTML = '<div style="color:var(--color-primary);"><i class="fa-solid fa-spinner fa-spin"></i> Executing semantic cross-reference...</div>';

    setTimeout(() => {
      let matchedDoc = null;
      let snippet = "";
      const lowerQuery = query.toLowerCase();

      // Search matching keyword inside our local file contents registry
      for (const doc of window.kbInjectedDocs) {
        if (doc.content.toLowerCase().includes(lowerQuery)) {
          matchedDoc = doc;
          const idx = doc.content.toLowerCase().indexOf(lowerQuery);
          const start = Math.max(0, idx - 40);
          const end = Math.min(doc.content.length, idx + lowerQuery.length + 80);
          snippet = "..." + doc.content.substring(start, end).trim() + "...";
          break;
        }
      }

      let answer = "";
      if (matchedDoc) {
        answer = `🤖 **Answer (Found in ${matchedDoc.name}):** ${snippet}<br><span style="font-size:0.65rem; color:var(--text-muted); display:block; margin-top:4px;">Reference file match confidence: 95%</span>`;
      } else {
        // Fallback default synthesis
        if (lowerQuery.includes('remote') || lowerQuery.includes('work') || lowerQuery.includes('policy')) {
          answer = `🤖 **Answer:** Based on semantic search inside **Company Handbook.pdf** (Section 4.2): Employees are permitted to coordinate up to 2 days of remote work per calendar week. Core office hours remain 10 AM to 4 PM.`;
        } else if (lowerQuery.includes('sales') || lowerQuery.includes('target') || lowerQuery.includes('q1') || lowerQuery.includes('revenue')) {
          answer = `🤖 **Answer:** Cross-referencing database archives shows the Q1 aggregate sales target is set to **$150,000**, with monthly automation metrics growth benchmarked at **12%**.`;
        } else {
          answer = `🤖 **Answer:** We found no explicit sentence matching "${query}" in the active files index. Connecting query vector to general AI co-pilot weights... Default security and SLA protocols remain operational.`;
        }
      }

      kbQueryResponse.innerHTML = answer;
      logActivity('Docs Assistant', `Answered semantic search: "${query.substring(0, 30)}..."`);
    }, 1000);
  }

  // -------------------------------------------------------------
  // 8. Wire Actions for the 5 Sub-Dashboard Panels
  // -------------------------------------------------------------
  document.querySelectorAll('.btn-back-to-suite').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab('ai-suite');
    });
  });

  // A. Website Builder Dashboard Logic
  const btnWebGen = document.getElementById('btn-web-generate-panel');
  if (btnWebGen) {
    btnWebGen.addEventListener('click', () => {
      const title = document.getElementById('web-title-panel').value || 'Apex AI Portals';
      const theme = document.getElementById('web-theme-panel').value;
      const purpose = document.getElementById('web-purpose-panel').value || 'Consulting Agency landing page';
      const preview = document.getElementById('web-preview-pane-panel');

      preview.innerHTML = '<div style="color:var(--color-primary); font-size:1.2rem; width:100%; text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Instantiating HTML components & style templates...</div>';

      setTimeout(() => {
        let bg = '#0f172a', txt = '#ffffff', accent = '#8b5cf6', btnGrad = 'linear-gradient(135deg, #8b5cf6, #06b6d4)';
        if (theme === 'light') { bg = '#f9fafb'; txt = '#111827'; accent = '#7c3aed'; btnGrad = '#7c3aed'; }
        else if (theme === 'glass') { bg = '#111827'; txt = '#f3f4f6'; accent = '#06b6d4'; btnGrad = 'rgba(255,255,255,0.08)'; }

        let activeTemplate = 'business';
        const activeCard = document.querySelector('.web-template-card.active');
        if (activeCard) activeTemplate = activeCard.dataset.template;

        let templateContent = '';
        let extraStyles = '';
        let extraScripts = '';

        if (activeTemplate === 'portfolio') {
          templateContent = `
            <canvas id="portfolio-particles" style="position:fixed; top:0; left:0; width:100%; height:100%; z-index:-1; opacity:0.5; pointer-events:none;"></canvas>
            <div class="header-nav" style="display:flex; justify-content:space-between; align-items:center; padding:20px 40px; box-sizing:border-box;">
              <span class="logo" style="font-weight:bold; font-size:1.1rem; letter-spacing:2px; color:${accent};">PORTFOLIO</span>
              <a href="#" class="btn-contact" style="background:rgba(255,255,255,0.05); color:#fff; padding:8px 16px; border:1px solid rgba(255,255,255,0.1); border-radius:20px; text-decoration:none; font-size:0.75rem;">Get In Touch</a>
            </div>
            <div class="portfolio-hero" style="max-width:800px; margin:60px auto 40px auto; padding:0 20px; text-align:center;">
              <div class="avatar-glow" style="width:80px; height:80px; border-radius:50%; background:${btnGrad}; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:1.5rem; color:#fff; margin:0 auto 20px auto; box-shadow:0 0 25px ${accent};">JD</div>
              <h1 style="font-size:2.5rem; margin:0; color:#fff; font-weight:800;">${title}</h1>
              <p class="tagline" style="color:${accent}; font-size:0.95rem; font-weight:600; margin-top:8px; text-transform:uppercase; letter-spacing:1px;">Creative Tech Designer</p>
              <p class="desc" style="color:#94a3b8; font-size:0.9rem; line-height:1.6; max-width:600px; margin:15px auto 25px auto;">${purpose}. Powered by immersive interactive layouts and 3D modules.</p>
              <div class="stack-badges" style="display:flex; gap:8px; justify-content:center; margin-bottom:30px;">
                <span class="badge" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:4px 12px; border-radius:12px; font-size:0.7rem; color:#94a3b8;">React</span>
                <span class="badge" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:4px 12px; border-radius:12px; font-size:0.7rem; color:#94a3b8;">Three.js</span>
                <span class="badge" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:4px 12px; border-radius:12px; font-size:0.7rem; color:#94a3b8;">Node.js</span>
              </div>
            </div>
          `;
          extraStyles = `
            body { background: #070b13; color: #e2e8f0; font-family: sans-serif; margin: 0; min-height: 100vh; overflow-x: hidden; position: relative; }
          `;
          extraScripts = `
            <script>
              const canvas = document.getElementById('portfolio-particles');
              const ctx = canvas.getContext('2d');
              let particles = [];
              function resize() {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
              }
              window.addEventListener('resize', resize);
              resize();
              class P {
                constructor() {
                  this.x = Math.random() * canvas.width;
                  this.y = Math.random() * canvas.height;
                  this.vx = (Math.random() - 0.5) * 0.5;
                  this.vy = (Math.random() - 0.5) * 0.5;
                  this.radius = Math.random() * 1.5 + 0.5;
                }
                u() {
                  this.x += this.vx; this.y += this.vy;
                  if (this.x<0 || this.x>canvas.width) this.vx *= -1;
                  if (this.y<0 || this.y>canvas.height) this.vy *= -1;
                }
                d() {
                  ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
                  ctx.fillStyle = '${accent}'; ctx.fill();
                }
              }
              for (let i=0; i<25; i++) particles.push(new P());
              function anim() {
                ctx.clearRect(0,0,canvas.width,canvas.height);
                particles.forEach(p => { p.u(); p.d(); });
                ctx.beginPath();
                for (let i=0; i<particles.length; i++) {
                  for (let j=i+1; j<particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const d = Math.sqrt(dx*dx + dy*dy);
                    if (d < 85) {
                      ctx.moveTo(particles[i].x, particles[i].y);
                      ctx.lineTo(particles[j].x, particles[j].y);
                    }
                  }
                }
                ctx.strokeStyle = 'rgba(139,92,246,0.1)'; ctx.lineWidth = 0.5; ctx.stroke();
                requestAnimationFrame(anim);
              }
              anim();
            </script>
          `;
        } else if (activeTemplate === 'saas') {
          templateContent = `
            <div class="saas-nav" style="display:flex; justify-content:space-between; align-items:center; padding:20px 40px; border-bottom:1px solid rgba(255,255,255,0.05);">
              <span class="brand" style="font-weight:800; font-size:1.25rem; color:#fff;">CloudSync</span>
              <button class="btn-trial" style="background:${accent}; border:none; color:#fff; font-size:0.75rem; font-weight:700; padding:8px 18px; border-radius:6px; cursor:pointer;">Start Free</button>
            </div>
            <div class="saas-hero" style="text-align:center; max-width:700px; margin:70px auto 40px auto; padding:0 20px;">
              <div class="pill-announcement" style="display:inline-block; background:rgba(6,182,212,0.1); border:1px solid rgba(6,182,212,0.2); color:#06b6d4; font-size:0.65rem; font-weight:bold; padding:4px 12px; border-radius:9999px; margin-bottom:20px; text-transform:uppercase;">v2.4 Immersive Release</div>
              <h1 style="font-size:2.4rem; color:#fff; font-weight:800; line-height:1.2; margin:0;">Optimize API Handshakes Instantly</h1>
              <p class="purpose-desc" style="font-size:0.95rem; color:#64748b; margin-top:16px; line-height:1.5;">${purpose}. Connected via secure automatic workflows.</p>
              <div style="margin-top:20px;"><button class="btn" style="background:${btnGrad}; color:#fff; padding:10px 24px; border:none; border-radius:6px; font-weight:bold;">Deploy Workspace App</button></div>
            </div>
          `;
          extraStyles = `
            body { background: #090d16; color: #f1f5f9; font-family: sans-serif; margin: 0; padding: 0; }
          `;
        } else if (activeTemplate === 'landing') {
          templateContent = `
            <div class="landing-hero" style="text-align:center; max-width:600px; margin: 80px auto;">
              <span class="badge-tag" style="background:rgba(236,72,153,0.1); border:1px solid rgba(236,72,153,0.2); color:#ec4899; font-size:0.65rem; font-weight:700; padding:4px 10px; border-radius:9999px; text-transform:uppercase; display:inline-block; margin-bottom:16px;">Platform Automation</span>
              <h1 style="font-size:2.8rem; color:#fff; margin:0; font-weight:900; letter-spacing:-1px;">${title}</h1>
              <p class="tagline" style="color:#9ca3af; font-size:0.95rem; margin-top:8px;">${purpose}</p>
              <div class="form-wrapper" style="display:flex; gap:8px; margin-top:24px; justify-content:center;">
                <input type="email" placeholder="Enter company email..." class="email-inp" style="padding:10px 14px; border-radius:6px; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.4); color:#fff; font-size:0.8rem; outline:none; width:220px;">
                <button class="btn" style="background:${btnGrad}; color:#fff; border:none; font-weight:bold; padding: 10px 24px; font-size:0.8rem; border-radius:6px;">Initialize Suite</button>
              </div>
            </div>
          `;
          extraStyles = `
            body { background: #030712; color: #f9fafb; font-family: sans-serif; margin:0; }
          `;
        } else {
          templateContent = `
            <div class="card" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; max-width: 500px; margin: 40px auto; box-shadow: 0 10px 30px rgba(0,0,0,0.25);">
              <h1 style="color: ${txt}; font-size: 2.2rem; margin-bottom: 12px;">${title}</h1>
              <p style="color: ${theme === 'light' ? '#4b5563' : '#9ca3af'}; font-size: 0.95rem; margin-bottom: 24px; line-height: 1.6;">Automated premium operations for ${purpose}. Powered by NexusHub AI workflows.</p>
              <button class="btn" style="background: ${btnGrad}; color: #fff; padding: 12px 28px; border-radius: 9999px; border: none; font-size: 0.9rem; cursor: pointer; font-weight: bold; text-decoration: none;" onclick="alert('Welcome to ${title}!')">Connect Now</button>
            </div>
          `;
          extraStyles = `
            body { background-color: ${bg}; color: ${txt}; font-family: sans-serif; padding: 40px; margin: 0; text-align: center; }
          `;
        }

        const siteHTML = `<!DOCTYPE html>
<html>
<head>
  <style>
    ${extraStyles}
  </style>
</head>
<body>
  ${templateContent}
  ${extraScripts}
</body>
</html>`;

        // Render code preview in iframe and show options
        preview.innerHTML = `
          <div style="width:100%; display:flex; flex-direction:column; gap:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.75rem; color:var(--text-secondary);">Live Interactive Preview (IFrame)</span>
              <div style="display:flex; gap:8px;">
                <button type="button" class="btn-secondary" id="btn-web-toggle-code" style="padding:4px 8px; font-size:0.65rem;">View Source Code</button>
                <button type="button" class="btn-primary" id="btn-web-download" style="padding:4px 10px; font-size:0.65rem;"><i class="fa-solid fa-download"></i> Export HTML</button>
              </div>
            </div>
            <iframe class="web-preview-iframe" id="web-builder-iframe"></iframe>
            <div id="web-code-editor-wrapper" style="display:none; flex-direction:column; gap:8px;">
              <textarea id="web-source-code" rows="10" style="width:100%; font-family:monospace; font-size:0.7rem; padding:10px; background:#05070f; border:1px solid var(--border-color); color:#10b981; border-radius:8px;">${siteHTML}</textarea>
              <button type="button" class="btn-primary" id="btn-web-apply-code" style="padding:6px 12px; font-size:0.7rem; justify-content:center;">Apply Code Changes</button>
            </div>
          </div>
        `;

        const iframe = document.getElementById('web-builder-iframe');
        const applyIframe = (html) => {
          const doc = iframe.contentWindow.document;
          doc.open();
          doc.write(html);
          doc.close();
        };
        applyIframe(siteHTML);

        // Bind code editor toggle
        const toggleCodeBtn = document.getElementById('btn-web-toggle-code');
        const codeWrapper = document.getElementById('web-code-editor-wrapper');
        toggleCodeBtn.addEventListener('click', () => {
          if (codeWrapper.style.display === 'none') {
            codeWrapper.style.display = 'flex';
            iframe.style.display = 'none';
            toggleCodeBtn.innerText = 'Show Web Preview';
          } else {
            codeWrapper.style.display = 'none';
            iframe.style.display = 'block';
            toggleCodeBtn.innerText = 'View Source Code';
          }
        });

        // Bind Code application
        const btnApplyCode = document.getElementById('btn-web-apply-code');
        btnApplyCode.addEventListener('click', () => {
          const editedHTML = document.getElementById('web-source-code').value;
          applyIframe(editedHTML);
          codeWrapper.style.display = 'none';
          iframe.style.display = 'block';
          toggleCodeBtn.innerText = 'View Source Code';
          logActivity('Web Builder', 'Custom source code revisions compiled onto Live Preview.');
        });

        // Bind Download Webpage
        document.getElementById('btn-web-download').addEventListener('click', () => {
          const content = document.getElementById('web-source-code').value;
          const blob = new Blob([content], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'index.html';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          logActivity('Web Builder', `Downloaded index.html webpage file for: ${title}`);
        });

        // Save generated site in local storage list for Portfolio showcase
        const generatedSites = JSON.parse(safeStorage.getItem('generated_sites') || '[]');
        generatedSites.push({
          company: title,
          template: activeTemplate,
          code: siteHTML,
          timestamp: new Date().toLocaleDateString()
        });
        safeStorage.setItem('generated_sites', JSON.stringify(generatedSites));
        if (window.refreshPortfolioShowroom) window.refreshPortfolioShowroom();

        logActivity('Web Builder', `Compiled new webpage blueprint: ${title}`);
      }, 1000);
    });
  }

  // Handle Website Template Card clicks
  document.querySelectorAll('.web-template-card').forEach(card => {
    card.addEventListener('click', () => {
      const template = card.dataset.template;
      const titleInput = document.getElementById('web-title-panel');
      const themeSelect = document.getElementById('web-theme-panel');
      const purposeInput = document.getElementById('web-purpose-panel');
      
      document.querySelectorAll('.web-template-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      if (template === 'business') {
        if (titleInput) titleInput.value = 'Apex Consulting Group';
        if (themeSelect) themeSelect.value = 'glass';
        if (purposeInput) purposeInput.value = 'Professional financial planning & technology audits.';
      } else if (template === 'portfolio') {
        if (titleInput) titleInput.value = 'Jane Doe Portfolio';
        if (themeSelect) themeSelect.value = 'light';
        if (purposeInput) purposeInput.value = 'Interactive 3D designer portfolio featuring React & WebGL.';
      } else if (template === 'saas') {
        if (titleInput) titleInput.value = 'CloudSync SaaS Platform';
        if (themeSelect) themeSelect.value = 'cyber';
        if (purposeInput) purposeInput.value = 'Real-time database sync cluster dashboard and webhook tools.';
      } else if (template === 'landing') {
        if (titleInput) titleInput.value = 'NexusHub Glow Launch Page';
        if (themeSelect) themeSelect.value = 'cyber';
        if (purposeInput) purposeInput.value = 'Product launch landing page highlighting AI automation features.';
      }
      
      if (btnWebGen) btnWebGen.click();
    });
  });

  const btnPropGen = document.getElementById('btn-prop-generate-panel');
  if (btnPropGen) {
    btnPropGen.addEventListener('click', () => {
      const client = document.getElementById('prop-client-panel').value || 'Target Client';
      const scope = document.getElementById('prop-scope-panel').value || 'Automated data routing workspace development.';
      const budget = document.getElementById('prop-budget-panel').value || '$5,000 fixed price';
      const template = document.getElementById('prop-template-panel').value;
      const preview = document.getElementById('prop-preview-pane-panel');
      const milestoneText = document.getElementById('prop-milestones-panel').value || '';
      const termsText = document.getElementById('prop-terms-panel').value || 'Net-15 payment terms.';

      const milestones = milestoneText.split(';').map(m => m.trim()).filter(Boolean);

      preview.innerHTML = '<div style="color:var(--color-primary); font-size:1.2rem; width:100%; text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Writing agreement draft...</div>';

      setTimeout(() => {
        let templateName = 'SaaS Service Agreement';
        if (template === 'agency') templateName = 'Consulting Terms Contract';
        else if (template === 'nd') templateName = 'NDA Non-Disclosure Agreement';

        let milestoneRows = '';
        if (milestones.length > 0) {
          milestoneRows = milestones.map((m, idx) => `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
              <td style="padding:4px 0;">Phase ${idx+1}: ${m}</td>
              <td style="padding:4px 0; text-align:right; color:var(--color-primary); font-weight:600;">Staged</td>
            </tr>
          `).join('');
        }

        preview.innerHTML = `
          <div style="width:100%; display:flex; flex-direction:column; gap:12px; align-items:stretch;">
            <div class="contract-mockup-paper" style="background:#1e293b; border:1px solid var(--border-color); padding:20px; border-radius:12px; text-align:left; font-size:0.7rem; color:var(--text-secondary); box-sizing:border-box;">
              <div class="contract-header" style="font-size:0.95rem; font-weight:700; color:#fff; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:8px; margin-bottom:12px; text-align:center;">${templateName}</div>
              <p style="margin-bottom:8px;">This Agreement is entered into by and between <strong>NexusHub AI</strong> (hereinafter "Provider") and <strong>${client}</strong> (hereinafter "Client").</p>
              
              <div class="contract-section-title" style="font-weight:700; color:#fff; margin-top:12px; margin-bottom:4px;">1. Scope of Deliverables</div>
              <p style="margin-bottom:8px; font-style:italic;">Provider agrees to engineer, compile, and configure the following features: ${scope}.</p>
              
              ${milestones.length > 0 ? `
                <div class="contract-section-title" style="font-weight:700; color:#fff; margin-top:12px; margin-bottom:4px;">2. Project Milestones Schedule</div>
                <table style="width:100%; border-collapse:collapse; font-size:0.65rem; color:var(--text-secondary); margin-bottom:8px;">
                  <thead>
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.1); text-align:left;">
                      <th style="padding:4px 0; color:#fff;">Phase</th>
                      <th style="padding:4px 0; color:#fff; text-align:right;">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${milestoneRows}
                  </tbody>
                </table>
              ` : ''}

              <div class="contract-section-title" style="font-weight:700; color:#fff; margin-top:12px; margin-bottom:4px;">3. Fees & Compensation</div>
              <p style="margin-bottom:8px;">Client agrees to compensate Provider the sum of <strong>${budget}</strong> upon completion and inspection of milestones.</p>
              
              <div class="contract-section-title" style="font-weight:700; color:#fff; margin-top:12px; margin-bottom:4px;">4. Contract Terms & SLA Notes</div>
              <p style="margin-bottom:12px;">${termsText}</p>
              
              <div class="sig-canvas-wrapper">
                <canvas class="sig-draw-canvas" id="prop-signature-canvas"></canvas>
                <div style="position:absolute; bottom:6px; left:10px; font-size:0.5rem; color:var(--text-muted); pointer-events:none;"><i class="fa-solid fa-pencil"></i> Sign above using mouse/touch pointer</div>
              </div>

              <div class="contract-signature-line" style="display:flex; justify-content:space-between; margin-top:16px; border-top:1px dashed rgba(255,255,255,0.05); padding-top:8px;">
                 <div style="font-size:0.6rem; color:var(--text-muted);">Representative: NexusHub AI</div>
                 <div style="font-size:0.6rem; color:var(--text-muted); text-align:right;">Client Manager: ${client}</div>
              </div>
            </div>
            <div style="display:flex; gap:10px; justify-content:center;">
              <button type="button" class="btn-secondary" id="btn-prop-clear-sig" style="font-size:0.7rem; padding:6px 12px;">Clear Signature</button>
              <button type="button" class="btn-primary" id="btn-prop-download-pdf" style="font-size:0.7rem; padding:6px 16px;"><i class="fa-solid fa-file-pdf"></i> Export Proposal (PDF)</button>
            </div>
          </div>
        `;

        // Save generated proposal to safeStorage for dynamic listing in Portfolio showroom
        const generatedProposals = JSON.parse(safeStorage.getItem('generated_proposals') || '[]');
        generatedProposals.push({
          client: client,
          budget: budget,
          code: preview.innerHTML,
          timestamp: new Date().toLocaleDateString()
        });
        safeStorage.setItem('generated_proposals', JSON.stringify(generatedProposals));
        if (window.refreshPortfolioShowroom) window.refreshPortfolioShowroom();

        // Canvas Signature Pad Drawer
        const canvas = document.getElementById('prop-signature-canvas');
        if (canvas) {
          const ctx = canvas.getContext('2d');
          let drawing = false;
          
          canvas.width = canvas.parentElement.clientWidth;
          canvas.height = 120;
          
          ctx.strokeStyle = '#8b5cf6';
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';

          canvas.addEventListener('mousedown', (e) => { drawing = true; draw(e); });
          canvas.addEventListener('mousemove', draw);
          canvas.addEventListener('mouseup', () => { drawing = false; ctx.beginPath(); });
          
          canvas.addEventListener('touchstart', (e) => { drawing = true; draw(e.touches[0]); });
          canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e.touches[0]); });
          canvas.addEventListener('touchend', () => { drawing = false; ctx.beginPath(); });

          function draw(e) {
            if (!drawing) return;
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
          }

          document.getElementById('btn-prop-clear-sig').addEventListener('click', () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          });
        }

        // Export Print/Download in a clean printable tab
        document.getElementById('btn-prop-download-pdf').addEventListener('click', () => {
          logActivity('Proposal Gen', `Exported signature contract for ${client}`);
          const printWindow = window.open('', '_blank');
          printWindow.document.write(`
            <html>
            <head>
              <title>${templateName} - ${client}</title>
              <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #111827; background: #fff; padding: 40px; }
                .container { max-width: 800px; margin: 0 auto; border: 1px solid #e5e7eb; padding: 40px; border-radius: 12px; }
                .header { text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
                h1 { margin: 0; color: #1f2937; font-size: 24px; }
                .section-title { font-weight: bold; color: #1f2937; font-size: 16px; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
                p { font-size: 14px; line-height: 1.6; color: #4b5563; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 15px; }
                th, td { border: 1px solid #e5e7eb; padding: 10px; font-size: 13px; text-align: left; }
                th { background: #f3f4f6; }
                .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
                .sig-line { border-top: 1px solid #d1d5db; width: 45%; padding-top: 8px; font-size: 12px; color: #4b5563; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>${templateName}</h1>
                  <p style="margin: 4px 0 0 0;">Reference ID: NX-${Math.floor(Math.random()*100000)}</p>
                </div>
                <p>This Agreement is entered into by and between <strong>NexusHub AI</strong> (hereinafter "Provider") and <strong>${client}</strong> (hereinafter "Client").</p>
                
                <div class="section-title">1. Scope of Deliverables</div>
                <p>Provider agrees to engineer, compile, and configure the following features: ${scope}.</p>
                
                ${milestones.length > 0 ? `
                  <div class="section-title">2. Project Milestones Schedule</div>
                  <table>
                    <thead>
                      <tr>
                        <th>Phase</th>
                        <th>Deliverables Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${milestones.map((m, idx) => `
                        <tr>
                          <td>Phase ${idx+1}</td>
                          <td>${m}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                ` : ''}
                
                <div class="section-title">3. Fees & Compensation</div>
                <p>Client agrees to compensate Provider the sum of <strong>${budget}</strong> upon completion and inspection of milestones.</p>
                
                <div class="section-title">4. Contract Terms & SLA Notes</div>
                <p>${termsText}</p>
                
                <div class="section-title">5. Signatures & Approvals</div>
                <p>The parties hereunto agree to all terms outlined above.</p>
                <div class="signatures">
                  <div class="sig-line">
                    Provider Representative: NexusHub AI<br>
                    Date: ${new Date().toLocaleDateString()}
                  </div>
                  <div class="sig-line">
                    Client Authorized Manager: ${client}<br>
                    Date: ${new Date().toLocaleDateString()}
                  </div>
                </div>
              </div>
              <script>
                window.onload = function() { window.print(); }
              </script>
            </body>
            </html>
          `);
          printWindow.document.close();
        });

        logActivity('Proposal Gen', `Drafted contract proposal for: ${client}`);
      }, 1200);
    });
  }

  // Handle Proposal Generator Recent Items clicks
  document.querySelectorAll('.recent-proposal-item').forEach(item => {
    item.addEventListener('click', () => {
      const type = item.dataset.prop;
      const clientInput = document.getElementById('prop-client-panel');
      const scopeInput = document.getElementById('prop-scope-panel');
      const budgetInput = document.getElementById('prop-budget-panel');
      const templateSelect = document.getElementById('prop-template-panel');

      document.querySelectorAll('.recent-proposal-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      if (type === 'automation') {
        if (clientInput) clientInput.value = 'Acme Corp';
        if (scopeInput) scopeInput.value = 'Automated data routing workspace development.';
        if (budgetInput) budgetInput.value = '$8,500 One-time';
        if (templateSelect) templateSelect.value = 'saas';
      } else if (type === 'digital') {
        if (clientInput) clientInput.value = 'Globex';
        if (scopeInput) scopeInput.value = 'Digital migration of client databases & API wrappers.';
        if (budgetInput) budgetInput.value = '$15,000 Milestone pricing';
        if (templateSelect) templateSelect.value = 'agency';
      } else if (type === 'marketing') {
        if (clientInput) clientInput.value = 'Initech';
        if (scopeInput) scopeInput.value = 'SEO marketing copy layout audits & automated hyper campaigns.';
        if (budgetInput) budgetInput.value = '$5,000 Monthly retainer';
        if (templateSelect) templateSelect.value = 'agency';
      } else if (type === 'webdev') {
        if (clientInput) clientInput.value = 'Umbrella Corp';
        if (scopeInput) scopeInput.value = 'Complete landing page revamp using Outfit theme parameters.';
        if (budgetInput) budgetInput.value = '$12,000 Fixed cost';
        if (templateSelect) templateSelect.value = 'saas';
      } else if (type === 'crm') {
        if (clientInput) clientInput.value = 'Weyland Yutani';
        if (scopeInput) scopeInput.value = 'Setup compliance-ready SOC 2 endpoints and Salesforce triggers.';
        if (budgetInput) budgetInput.value = '$20,000 Milestone pricing';
        if (templateSelect) templateSelect.value = 'nd';
      }

      if (btnPropGen) btnPropGen.click();
    });
  });

  const btnResumeAnalyze = document.getElementById('btn-resume-analyze-panel');
  const resumeDropzone = document.getElementById('resume-upload-dropzone') || document.querySelector('.playground-preview-panel');
  
  // Create File Dropzone in Resume Panel Form
  if (resumeDropzone) {
    const formPanel = document.querySelector('#panel-resume-analyzer .playground-form-panel');
    if (formPanel && !document.getElementById('resume-file-picker')) {
      const dropDiv = document.createElement('div');
      dropDiv.id = 'resume-file-picker';
      dropDiv.style.cssText = 'border:2px dashed var(--border-color); border-radius:12px; padding:16px; text-align:center; margin-bottom:12px; cursor:pointer; background:rgba(255,255,255,0.01); transition: all 0.2s;';
      dropDiv.innerHTML = `
        <i class="fa-solid fa-file-upload" style="font-size:2rem; color:var(--color-primary); margin-bottom:6px;"></i>
        <div style="font-size:0.75rem; color:#fff; font-weight:600;">Drag Resume PDF/Image (Max 50MB)</div>
        <div style="font-size:0.6rem; color:var(--text-muted); margin-top:2px;">or click to browse local files</div>
        <input type="file" id="resume-upload-input" style="display:none;" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg">
      `;
      formPanel.insertBefore(dropDiv, formPanel.querySelector('.playground-form-group'));

      dropDiv.addEventListener('click', () => {
        document.getElementById('resume-upload-input').click();
      });

      document.getElementById('resume-upload-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleResumeFile(file);
      });

      dropDiv.addEventListener('dragover', (e) => { e.preventDefault(); dropDiv.style.borderColor = 'var(--color-primary)'; });
      dropDiv.addEventListener('dragleave', () => { dropDiv.style.borderColor = 'var(--border-color)'; });
      dropDiv.addEventListener('drop', (e) => {
        e.preventDefault();
        dropDiv.style.borderColor = 'var(--border-color)';
        const file = e.dataTransfer.files[0];
        if (file) handleResumeFile(file);
      });
    }
  }

  function handleResumeFile(file) {
    if (file.size > 50 * 1024 * 1024) {
      alert(`Resume rejected: "${file.name}" is ${((file.size)/(1024*1024)).toFixed(1)}MB. Maximum resume limit is 50MB.`);
      return;
    }
    
    const preview = document.getElementById('resume-preview-pane-panel');
    preview.innerHTML = `<div style="color:var(--color-primary); font-size:1.2rem; width:100%; text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Uploading ${file.name}... [Size: ${((file.size)/(1024*1024)).toFixed(2)}MB]</div>`;
    
    let parsedText = `Applicant Profile name: Alex Mercer. Focus in React, Redux, Node.js. 4 years of frontend dashboard design.`;
    if (file.name.toLowerCase().includes('doe')) parsedText = `Jane Doe. Project Manager with Agile metrics focus.`;

    setTimeout(() => {
      document.getElementById('resume-text-panel').value = parsedText;
      if (btnResumeAnalyze) btnResumeAnalyze.click();
    }, 1200);
  }

  // Templates database
  const resumeTemplates = {
    software: {
      job: "Senior Software Engineer",
      text: "John Doe\nEmail: john.doe@gmail.com\nSummary: 6 years of experience building scalable Javascript applications. Expert in React, Node.js, and browser web applications. Designed complex workflows and managed database schema migrations.\nSkills: JavaScript, HTML, CSS, React, NodeJS, Git, PostgreSQL, REST APIs.\nProjects: Designed an enterprise CRM interface. Optimized database queries reducing page load times by 40%.",
      name: "John Doe",
      email: "john.doe@gmail.com",
      avatar: "https://randomuser.me/api/portraits/men/32.jpg",
      score: 88,
      skills: [
        { name: "JavaScript & DOM", val: 92 },
        { name: "React Framework", val: 90 },
        { name: "Node.js Backend", val: 82 }
      ],
      add: "Add cloud deployment credits (AWS/GCP), specify unit testing suite frameworks (Jest/Playwright).",
      remove: "Remove outdated Java programming coursework, condense high school jobs listing."
    },
    marketing: {
      job: "Digital Marketing Manager",
      text: "Sarah Jenkins\nEmail: sarah.jenkins@marketing.co\nSummary: Dynamic Marketing Lead with 5+ years of digital advertising experience. Specialized in SEO audit checkups, Google Analytics, social media suites, and automated email campaigns.\nSkills: SEO optimization, Copywriting, Google Analytics, HubSpot, Mailchimp, Adwords.\nProjects: Managed $50k monthly ad budgets. Increased organic conversion rates by 22% via SEO keyword targeting.",
      name: "Sarah Jenkins",
      email: "sarah.jenkins@marketing.co",
      avatar: "https://randomuser.me/api/portraits/women/44.jpg",
      score: 84,
      skills: [
        { name: "SEO Optimization", val: 90 },
        { name: "Copywriting Tone", val: 86 },
        { name: "Google Analytics", val: 78 }
      ],
      add: "Mention dollar value conversion metrics, list graphic design tools (Figma/Canva).",
      remove: "Remove retail cashier records, condense generic soft skills lists."
    },
    data: {
      job: "Data Scientist",
      text: "Alex Rivera\nEmail: alex.rivera@datacorp.io\nSummary: Data Scientist with expertise in predictive model checkpoint tuning, machine learning datasets, Python, and SQL building queries. Focused on anomaly detection and pricing engines.\nSkills: Python, SQL, Tableau, Llama inference, Pandas, Scikit-learn, TensorFlow.\nProjects: Built transaction logs fraud prediction model. Trained custom Claude-3-Instruct weights for CRM logs classification.",
      name: "Alex Rivera",
      email: "alex.rivera@datacorp.io",
      avatar: "https://randomuser.me/api/portraits/men/64.jpg",
      score: 91,
      skills: [
        { name: "Python & PyTorch", val: 94 },
        { name: "SQL DB Building", val: 92 },
        { name: "Model Checkpoints", val: 86 }
      ],
      add: "List GPU cluster specs (H100/A100), define exact data pipeline sizes (TB/PB).",
      remove: "Remove general Excel basic formula lists, condense undergraduate thesis details."
    }
  };

  const resumeTemplatesSelect = document.getElementById('resume-sample-templates');
  if (resumeTemplatesSelect) {
    resumeTemplatesSelect.addEventListener('change', () => {
      const val = resumeTemplatesSelect.value;
      if (val !== 'none' && resumeTemplates[val]) {
        document.getElementById('resume-job-panel').value = resumeTemplates[val].job;
        document.getElementById('resume-text-panel').value = resumeTemplates[val].text;
        btnResumeAnalyze.click();
      }
    });
  }

  if (btnResumeAnalyze) {
    btnResumeAnalyze.addEventListener('click', () => {
      const job = document.getElementById('resume-job-panel').value || 'Software Engineer';
      const rText = document.getElementById('resume-text-panel').value;
      const preview = document.getElementById('resume-preview-pane-panel');

      if (!rText.trim()) {
        alert('Please paste resume details or upload a file first!');
        return;
      }

      preview.innerHTML = '<div style="color:var(--color-primary); font-size:1.2rem; width:100%; text-align:center;"><i class="fa-solid fa-brain fa-pulse"></i> Computing parsing filters...</div>';

      setTimeout(() => {
        const atsWeightSlider = document.getElementById('settings-resume-ats-weight');
        const atsPriority = atsWeightSlider ? parseInt(atsWeightSlider.value) : 60;
        
        let templateKey = 'none';
        for (const [k, v] of Object.entries(resumeTemplates)) {
          if (rText.includes(v.name)) {
            templateKey = k;
            break;
          }
        }

        let name = "Alex Mercer";
        let email = "alex.mercer@gmail.com";
        let avatar = "https://randomuser.me/api/portraits/men/85.jpg";
        let score = Math.floor(Math.random() * 20) + 75; // Score 75-95
        let skills = [
          { name: "Core Skill Specs", val: 85 },
          { name: "Role Tech Stack", val: 80 },
          { name: "Operational Flow", val: 75 }
        ];
        let suggestionAdd = "Add project delivery metrics, list formal code framework versions.";
        let suggestionRemove = "Remove general soft skills terms, condense secondary job descriptions.";

        if (templateKey !== 'none' && resumeTemplates[templateKey]) {
          const t = resumeTemplates[templateKey];
          name = t.name;
          email = t.email;
          avatar = t.avatar;
          score = t.score;
          skills = t.skills;
          suggestionAdd = t.add;
          suggestionRemove = t.remove;
        } else if (rText.toLowerCase().includes('jane') || rText.toLowerCase().includes('doe')) {
          name = "Jane Doe";
          email = "jane.doe@gmail.com";
          avatar = "https://randomuser.me/api/portraits/women/12.jpg";
        }

        const questions = [
          `Why do you want to join our workspace team as a ${job}?`,
          `What is the most challenging technical project you worked on as a ${job}, and how did you resolve scaling bugs?`,
          `Can you describe how you configure automated pipelines or security scopes when handling high-volume operational workflows?`
        ];

        preview.innerHTML = `
          <div style="width:100%; display:flex; flex-direction:column; gap:12px; text-align:left;">
            <div style="display:flex; align-items:center; gap:16px; background:rgba(255,255,255,0.02); padding:10px; border-radius:12px; border:1px solid var(--border-color);">
              <img src="${avatar}" alt="Candidate" style="width:42px; height:42px; border-radius:50%; object-fit:cover; border:2px solid var(--color-primary);">
              <div>
                <h4 style="color:#fff; margin:0; font-size:0.95rem;">${name}</h4>
                <span style="font-size:0.7rem; color:var(--text-secondary);">${job} Applicant</span>
                <span style="font-size:0.65rem; color:var(--text-muted); display:block;"><i class="fa-solid fa-envelope"></i> ${email}</span>
              </div>
            </div>
            
            <div style="display:grid; grid-template-columns: 1fr 1.2fr; gap:10px;">
              <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-color); padding:10px; border-radius:12px; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                <span style="font-size:0.65rem; color:var(--text-secondary); margin-bottom:4px;">ATS Score (Weight: ${atsPriority}%)</span>
                <div class="resume-score-ring" style="--score-pct: ${score}; width:70px; height:70px; border-radius:50%; background:conic-gradient(var(--color-primary) calc(${score} * 1%), rgba(255,255,255,0.05) 0); display:flex; align-items:center; justify-content:center; position:relative;">
                  <div style="width:58px; height:58px; border-radius:50%; background:#121826; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:1.15rem;">${score}</div>
                </div>
              </div>
              
              <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-color); padding:10px; border-radius:12px;">
                <span style="font-size:0.65rem; color:var(--text-secondary); display:block; margin-bottom:4px;">Skills Match Rate</span>
                <div style="display:flex; flex-direction:column; gap:4px; font-size:0.6rem;">
                  ${skills.map(s => `
                    <div>${s.name} <span style="float:right; color:var(--color-success);">${s.val}%</span></div>
                    <div style="height:3px; background:rgba(255,255,255,0.05); overflow:hidden;"><div style="width:${s.val}%; height:100%; background:var(--color-success);"></div></div>
                  `).join('')}
                </div>
              </div>
            </div>

            <!-- AI Resume Enhancer Widget -->
            <div style="background:rgba(139,92,246,0.05); border:1px solid var(--border-color); padding:10px; border-radius:10px; display:flex; flex-direction:column; gap:4px;">
              <h5 style="color:#fff; font-size:0.72rem; display:flex; align-items:center; gap:6px; margin:0;"><i class="fa-solid fa-sparkles" style="color:var(--color-primary);"></i> AI Resume Enhancer Suggestions</h5>
              <div style="font-size:0.65rem; color:var(--text-secondary); line-height:1.4;">
                <div style="color:var(--color-success);"><strong style="color:#fff;">[SUGGESTED ADDITIONS]:</strong> ${suggestionAdd}</div>
                <div style="color:var(--color-danger); margin-top:3px;"><strong style="color:#fff;">[REDUNDANT REMOVALS]:</strong> ${suggestionRemove}</div>
              </div>
            </div>

            <!-- Prep Interview Launcher -->
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); padding:10px; border-radius:10px; display:flex; flex-direction:column; gap:6px;">
              <h5 style="color:#fff; font-size:0.72rem; margin:0;"><i class="fa-solid fa-circle-question" style="color:var(--color-secondary);"></i> Dynamic Interview Preparation Questions</h5>
              <div style="font-size:0.65rem; color:var(--text-muted); line-height:1.2;">
                ${questions.map((q, i) => `<div style="margin-top:2px;">${i+1}. ${q}</div>`).join('')}
              </div>
              <button type="button" class="btn-primary" id="btn-resume-load-simulator" style="font-size:0.65rem; padding:4px 8px; justify-content:center; margin-top:4px;">
                <i class="fa-solid fa-user-tie"></i> Load Questions into Interview Simulator
              </button>
            </div>
          </div>
        `;

        document.getElementById('btn-resume-load-simulator').addEventListener('click', () => {
          switchTab('interview-simulator');
          window.interviewPrepQuestions = questions;
          // Set inputs in Simulator automatically
          const simTopic = document.getElementById('interview-topic-panel');
          const simCount = document.getElementById('interview-count-panel');
          if (simTopic) simTopic.value = job;
          if (simCount) simCount.value = questions.length;
          logActivity('HR Agent', `Questions generated for ${name} loaded into the Interview Simulator context.`);
          alert("Dynamic preparation questions loaded! Click 'Start Practice Session' inside the Interview Simulator to begin.");
        });

        logActivity('HR Agent', `Analyzed resume. Score: ${score}% match for ${job}`);
      }, 1000);
    });
  }

  const interviewTypeBtns = document.querySelectorAll('.interview-type-btn-panel');
  let activeInterviewType = 'hr';

  interviewTypeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      interviewTypeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeInterviewType = btn.dataset.type;
    });
  });

  const btnInterviewStartPanel = document.getElementById('btn-interview-start-panel');
  const interviewChatFormPanel = document.getElementById('interview-chat-form-panel');
  const interviewQuestionLabelPanel = document.getElementById('interview-question-label-panel');
  const interviewAnswerPanel = document.getElementById('interview-answer-panel');
  const btnInterviewSubmitAnswerPanel = document.getElementById('btn-interview-submit-answer-panel');
  const interviewPreviewPanePanel = document.getElementById('interview-preview-pane-panel');

  let currentSimIndex = 0;
  let simCompletedCount = 12;
  let simAvgScoreSum = 12 * 78;
  let audioContext = null;
  let analyserNode = null;
  let mediaStream = null;
  let waveAnimationId = null;

  if (btnInterviewStartPanel) {
    btnInterviewStartPanel.addEventListener('click', () => {
      const topicVal = document.getElementById('interview-topic-panel').value || 'React Developer';
      const countVal = parseInt(document.getElementById('interview-count-panel').value) || 3;

      let qList = [];
      if (window.interviewPrepQuestions && window.interviewPrepQuestions.length > 0) {
        qList = window.interviewPrepQuestions.slice(0, countVal);
      } else {
        const defaultTopicQuestions = [
          `Explain how your tech stack experience qualifies you for a role as a ${topicVal}.`,
          `How do you diagnose memory leaks or rendering bottlenecks in a ${topicVal} environment?`,
          `Can you detail a complex scaling architecture you designed or managed for ${topicVal} projects?`,
          `What testing frameworks do you use to verify operational compliance of ${topicVal} code?`,
          `How do you handle API authentication or tokens synchronization securely in a ${topicVal} app?`,
          `Describe how you collaborate with designers and product managers to iterate on ${topicVal} visual features.`
        ];
        qList = defaultTopicQuestions.slice(0, countVal);
      }

      window.activeSimQuestionsList = qList;
      window.activeSimAnswersList = [];
      currentSimIndex = 0;

      btnInterviewStartPanel.style.display = 'none';
      interviewChatFormPanel.style.display = 'flex';
      setupInterviewMediaDevices();
      askNextSimQuestion();
    });
  }

  function setupInterviewMediaDevices() {
    interviewPreviewPanePanel.innerHTML = `
      <div style="width:100%; display:flex; flex-direction:column; gap:12px;">
        <div class="interview-video-pane" id="video-pane-container">
          <div class="interview-glowing-face" id="visual-video-fallback">
            <i class="fa-solid fa-user-circle fa-pulse" style="font-size:4rem; color:var(--color-primary); filter:drop-shadow(0 0 10px var(--color-primary));"></i>
          </div>
          <video class="interview-video-element" id="interview-video" autoplay playsinline muted style="display:none;"></video>
        </div>
        <div style="text-align:left;">
          <span style="font-size:0.65rem; color:var(--text-secondary); display:block; margin-bottom:4px;">Audio Waveform Analyzer</span>
          <canvas class="visual-wave-canvas" id="mic-waveform-canvas"></canvas>
        </div>
      </div>
    `;

    const video = document.getElementById('interview-video');
    const fallback = document.getElementById('visual-video-fallback');

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        mediaStream = stream;
        if (video) {
          video.srcObject = stream;
          video.style.display = 'block';
          fallback.style.display = 'none';
        }
        setupAudioWaveform(stream);
      })
      .catch(err => {
        console.warn("Media devices rejected, using visual fallback wireframe:", err);
        setupAudioWaveform(null);
      });
  }

  function setupAudioWaveform(stream) {
    const canvas = document.getElementById('mic-waveform-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = 48;

    if (stream && (window.AudioContext || window.webkitAudioContext)) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyserNode = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyserNode);
      analyserNode.fftSize = 64;
      const bufferLength = analyserNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      function drawRealWave() {
        waveAnimationId = requestAnimationFrame(drawRealWave);
        analyserNode.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = (canvas.width / bufferLength) * 1.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          barHeight = dataArray[i] / 2;
          ctx.fillStyle = `rgb(139, 92, ${246 - barHeight})`;
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
          x += barWidth;
        }
      }
      drawRealWave();
    } else {
      let phase = 0;
      function drawSimulatedWave() {
        waveAnimationId = requestAnimationFrame(drawSimulatedWave);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2;
        ctx.beginPath();
        phase += 0.15;
        
        for (let x = 0; x < canvas.width; x++) {
          const y = canvas.height / 2 + Math.sin(x * 0.05 + phase) * 8 * Math.sin(phase * 0.5);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      drawSimulatedWave();
    }
  }

  function askNextSimQuestion() {
    const qList = window.activeSimQuestionsList || [];

    if (currentSimIndex >= qList.length) {
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
      }
      if (waveAnimationId) cancelAnimationFrame(waveAnimationId);
      if (audioContext) audioContext.close();

      interviewChatFormPanel.style.display = 'none';
      btnInterviewStartPanel.style.display = 'block';
      btnInterviewStartPanel.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Start Practice Session';
      
      window.interviewPrepQuestions = null;

      simCompletedCount++;
      const finalScore = Math.floor(Math.random() * 20) + 75;
      simAvgScoreSum += finalScore;
      const avgPct = Math.round(simAvgScoreSum / simCompletedCount);

      const topicVal = document.getElementById('interview-topic-panel').value || 'React Developer';

      interviewPreviewPanePanel.innerHTML = `
        <div style="width:100%; display:flex; flex-direction:column; gap:12px; text-align:left;">
          <h4 style="color:#fff; font-size:0.9rem; border-bottom:1px solid var(--border-color); padding-bottom:6px; margin:0;">Performance Grading Card</h4>
          <div style="background:rgba(16,185,129,0.05); border:1px solid var(--color-success); padding:10px; border-radius:10px; text-align:center; font-size:0.75rem;">
            <strong style="color:#fff;">Congratulations!</strong> Core Score: <strong style="color:var(--color-success); font-size:1.1rem;">${finalScore}%</strong>
          </div>
          
          <div style="font-size:0.65rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:6px;">
            <div>Technical Skill Accuracy: <span style="float:right; color:#fff;">${Math.floor(Math.random()*15)+80}%</span></div>
            <div>Verbal Response Confidence: <span style="float:right; color:#fff;">${Math.floor(Math.random()*15)+80}%</span></div>
            <div>Problem Analysis Flow: <span style="float:right; color:#fff;">${Math.floor(Math.random()*15)+78}%</span></div>
            <div>Communication & Tone Accent: <span style="float:right; color:#fff;">${Math.floor(Math.random()*15)+82}%</span></div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin-top:4px;">
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); padding:8px; border-radius:8px; text-align:center;">
              <span style="font-size:0.55rem; color:var(--text-muted); display:block;">Completed</span>
              <span style="font-size:1.1rem; font-weight:700; color:#fff;">${simCompletedCount}</span>
            </div>
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); padding:8px; border-radius:8px; text-align:center;">
              <span style="font-size:0.55rem; color:var(--text-muted); display:block;">Avg Score</span>
              <span style="font-size:1.1rem; font-weight:700; color:var(--color-primary);">${avgPct}%</span>
            </div>
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); padding:8px; border-radius:8px; text-align:center;">
              <span style="font-size:0.55rem; color:var(--text-muted); display:block;">Best Score</span>
              <span style="font-size:1.1rem; font-weight:700; color:var(--color-secondary);">92%</span>
            </div>
          </div>
          
          <button type="button" class="btn-primary" id="btn-download-interview-prep" style="font-size:0.7rem; padding:8px 12px; justify-content:center; margin-top:6px;">
            <i class="fa-solid fa-download"></i> Download Interview Q&A Transcript
          </button>
        </div>
      `;

      // Bind dynamic download transcript
      const downloadBtn = document.getElementById('btn-download-interview-prep');
      if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
          logActivity('Interview Simulator', `Downloaded Q&A interview preparation transcript document.`);
          
          let transcriptHTML = `<!DOCTYPE html>
            <html>
            <head>
              <title>Interview Prep Guide - ${topicVal}</title>
              <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #111827; padding: 40px; background: #fff; }
                .container { max-width: 800px; margin: 0 auto; border: 1px solid #e5e7eb; padding: 30px; border-radius: 10px; }
                h1 { color: #1e3a8a; font-size: 22px; margin-bottom: 5px; }
                .meta { font-size: 12px; color: #6b7280; margin-bottom: 20px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
                .q-block { margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px dashed #e5e7eb; }
                .question { font-weight: bold; color: #1f2937; font-size: 14px; }
                .answer { background: #f9fafb; border-left: 3px solid #6b7280; padding: 10px; margin-top: 6px; font-size: 13px; color: #4b5563; }
                .feedback { background: #eff6ff; border-left: 3px solid #3b82f6; padding: 10px; margin-top: 6px; font-size: 13px; color: #1e40af; }
                .tips { background: #ecfdf5; border-left: 3px solid #10b981; padding: 10px; margin-top: 20px; font-size: 12px; border-radius: 4px; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>Interview Preparation & Transcript Guide</h1>
                <div class="meta">
                  Topic: <strong>${topicVal}</strong> | Grading Performance Score: <strong>${finalScore}%</strong> | Date: ${new Date().toLocaleDateString()}
                </div>
          `;

          window.activeSimAnswersList.forEach((item, index) => {
            const simulatedFeedback = `Expert Feedback: Answer accuracy is rated high (85%+). Good terminology coverage. Recommendation: Expand on code testing cycles and security parameters to stand out in a real live interview.`;
            transcriptHTML += `
              <div class="q-block">
                <div class="question">Q${index + 1}: ${item.q}</div>
                <div class="answer">Candidate Answer: ${item.a}</div>
                <div class="feedback">${simulatedFeedback}</div>
              </div>
            `;
          });

          transcriptHTML += `
                <div class="tips">
                  <strong>💡 Real Interview Success Tips:</strong><br>
                  1. Always link answer concepts to real project outcomes.<br>
                  2. Keep a structured approach (S.T.A.R method: Situation, Task, Action, Result).<br>
                  3. Be transparent about past deployment failures and how you adapted workflows.
                </div>
              </div>
            </body>
            </html>
          `;

          const blob = new Blob([transcriptHTML], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Interview_Prep_${topicVal.replace(/\\s+/g, '_')}.html`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        });
      }

      logActivity('HR Agent', `Mock interview simulation complete. Final Score: ${finalScore}%`);
      return;
    }

    const question = qList[currentSimIndex];
    interviewQuestionLabelPanel.innerHTML = `<strong>Question ${currentSimIndex + 1}:</strong> ${question}`;
    
    speakQuestionAloud(question);
    setupSpeechRecognition();
  }

  function speakQuestionAloud(text) {
    if ('speechSynthesis' in window) {
      const volumeSetting = parseFloat(document.getElementById('settings-tts-volume').value);
      const rateSetting = parseFloat(document.getElementById('settings-tts-rate').value);
      const pitchSetting = parseFloat(document.getElementById('settings-tts-pitch').value);
      const voiceIndex = document.getElementById('settings-tts-voice').value;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.volume = volumeSetting;
      utterance.rate = rateSetting;
      utterance.pitch = pitchSetting;

      const voices = window.speechSynthesis.getVoices();
      if (voiceIndex !== 'default' && voices[voiceIndex]) {
        utterance.voice = voices[voiceIndex];
      }

      window.speechSynthesis.speak(utterance);
    }
  }

  function setupSpeechRecognition() {
    const isSpeechEnabled = document.getElementById('settings-enable-speech-rec').checked;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (isSpeechEnabled && SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = function() {
        interviewAnswerPanel.placeholder = "Listening to vocal microphone response... (Speak now)";
      };

      recognition.onerror = function(e) {
        console.warn("Speech recognition error: ", e.error);
        interviewAnswerPanel.placeholder = "Type candidate answer response here...";
      };

      recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        interviewAnswerPanel.value = transcript;
        interviewAnswerPanel.placeholder = "Type candidate answer response here...";
        logActivity('Interview Simulator', 'Converted speech audio segment to answer text.');
      };

      recognition.start();
    }
  }

  if (btnInterviewSubmitAnswerPanel) {
    btnInterviewSubmitAnswerPanel.addEventListener('click', () => {
      const ansText = interviewAnswerPanel.value.trim();
      if (!ansText) return;

      const qList = window.activeSimQuestionsList || [];
      window.activeSimAnswersList.push({
        q: qList[currentSimIndex],
        a: ansText
      });

      interviewAnswerPanel.value = '';
      currentSimIndex++;
      
      const popupResult = document.createElement('div');
      popupResult.style.cssText = 'position:fixed; top:20px; right:20px; background:var(--color-primary); color:#fff; padding:10px 20px; border-radius:8px; z-index:99999; font-size:0.75rem; box-shadow:0 4px 10px rgba(0,0,0,0.5);';
      popupResult.innerText = `Answer submitted for question ${currentSimIndex}. Analyzing...`;
      document.body.appendChild(popupResult);
      setTimeout(() => popupResult.remove(), 1000);

      askNextSimQuestion();
    });
  }

  const btnLabLaunchPanel = document.getElementById('btn-lab-launch-panel');
  if (btnLabLaunchPanel) {
    btnLabLaunchPanel.addEventListener('click', () => {
      const model = document.getElementById('lab-model-panel').value;
      const dataset = document.getElementById('lab-dataset-panel').value;
      const lr = document.getElementById('lab-lr-panel').value || '2e-5';
      const preview = document.getElementById('lab-preview-pane-panel');

      preview.innerHTML = '<div style="color:var(--color-primary); font-size:1.1rem; width:100%; text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Initializing model fine-tuning weights...</div>';

      setTimeout(() => {
        preview.innerHTML = `
          <div style="text-align:left; width:100%; font-family:'Courier New', monospace; font-size:0.65rem; background:rgba(0,0,0,0.3); padding:12px; border-radius:8px; display:flex; flex-direction:column; gap:4px; color:#10b981; border:1px solid rgba(255,255,255,0.05); box-sizing:border-box;">
            <div>[SYSTEM] Ingesting: ${dataset}</div>
            <div>[SYSTEM] Epoch 1/3: Loss = 1.95, LR = ${lr}</div>
            <div>[SYSTEM] Epoch 2/3: Loss = 1.34, LR = ${lr}</div>
            <div>[SYSTEM] Epoch 3/3: Loss = 0.78, LR = ${lr}</div>
            <div style="color:#fff; margin-top:8px; font-weight:700;">[SUCCESS] Fine-Tuning Process Complete!</div>
            <div style="color:var(--text-secondary);">Model checkpoints compiled for dataset: ${dataset}</div>
          </div>
        `;
        logActivity('Innovation Lab', `Successfully fine-tuned model checkpoint on ${dataset}`);
        
        const sandboxInference = document.getElementById('lab-sandbox-inference');
        if (sandboxInference) {
          sandboxInference.style.display = 'flex';
        }
      }, 1500);
    });
  }

  const btnLabSandboxRun = document.getElementById('btn-lab-sandbox-run');
  if (btnLabSandboxRun) {
    btnLabSandboxRun.addEventListener('click', () => {
      const promptInput = document.getElementById('lab-sandbox-prompt');
      const outputDiv = document.getElementById('lab-sandbox-output');
      const model = document.getElementById('lab-model-panel').value;
      const dataset = document.getElementById('lab-dataset-panel').value;

      if (!promptInput || !outputDiv) return;

      const prompt = promptInput.value.trim();
      if (!prompt) {
        alert("Please enter a testing prompt first.");
        return;
      }

      outputDiv.style.display = 'block';
      outputDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Running inference...';

      setTimeout(() => {
        let response = '';
        if (dataset === 'support') {
          response = `[SUPPORT BOT - ${model.toUpperCase()}]\nProcessed user request: "${prompt}"\nRecommended Ticket Router Action: Resolve locally.\nSuggested Response: "Hello! We noticed your request about system logs. Our diagnostic checks show that all systems are operational. Please clear your cache or check console network logs."`;
        } else if (dataset === 'sales') {
          response = `[SALES BOT - ${model.toUpperCase()}]\nInput prompt: "${prompt}"\nRecommended Pitch Deck Angle: Cost Savings.\nSuggested Response: "Thank you for inquiring about NexusHub AI. By automating fine-tuning with a learning rate of 2e-5, teams save up to 40% on GPU resource overhead. Let's schedule a deep dive demo."`;
        } else {
          // code
          response = `[CODE BOT - ${model.toUpperCase()}]\nInput prompt: "${prompt}"\nRecommended AST Generation: Complete.\nSuggested Snippet:\n\`\`\`javascript\n// Autogenerated based on prompt\nfunction processData(input) {\n  const sanitized = input.trim().toLowerCase();\n  return { success: true, processedAt: Date.now(), query: sanitized };\n}\n\`\`\``;
        }

        outputDiv.innerText = response;
        logActivity('Innovation Lab', `Tested inference sandbox with prompt: "${prompt}"`);
      }, 1000);
    });
  }

  const btnLabCreateProject = document.getElementById('btn-lab-create-project');
  if (btnLabCreateProject) {
    btnLabCreateProject.addEventListener('click', () => {
      if (btnLabLaunchPanel) {
        alert("Initializing a new innovation lab template. Starting fine-tuning session...");
        btnLabLaunchPanel.click();
      }
    });
  }

  // -------------------------------------------------------------
  // 9. Knowledge Base Query binding
  // -------------------------------------------------------------
  if (kbQueryBtn) {
    kbQueryBtn.addEventListener('click', runKbQuery);
  }
  if (kbQueryInput) {
    kbQueryInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        runKbQuery();
      }
    });
  }

  // -------------------------------------------------------------
  // 10. Integrations Connection Overlay Modals
  // -------------------------------------------------------------
  const credentialsModal = document.getElementById('integration-credentials-modal');
  const configCloseBtn = document.getElementById('integration-config-close-btn');
  const disconnectBtn = document.getElementById('btn-integration-disconnect');
  const connectionForm = document.getElementById('integration-config-form');

  const integrationFieldsMap = {
    slack: `
      <div style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:0.75rem; color:var(--text-secondary);">Target Slack Channel</label>
        <input type="text" id="int-slack-channel" value="#alerts-dashboard" style="padding:10px; border:1px solid var(--border-color); border-radius:8px; background:rgba(0,0,0,0.2); color:#fff; outline:none; font-size:0.75rem; font-family: Outfit, sans-serif;">
      </div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:0.75rem; color:var(--text-secondary);">Notification Alert Level</label>
        <select id="int-slack-level" style="padding:10px; border:1px solid var(--border-color); border-radius:8px; background:#121826; color:#fff; outline:none; font-size:0.75rem; font-family: Outfit, sans-serif;">
          <option value="all">All Operational Events</option>
          <option value="errors">Error Logs Only</option>
          <option value="critical">Critical Handshakes Only</option>
        </select>
      </div>
    `,
    gmail: `
      <div style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:0.75rem; color:var(--text-secondary);">Notification Forward Address</label>
        <input type="email" id="int-gmail-forward" value="admin@nexushub.ai" style="padding:10px; border:1px solid var(--border-color); border-radius:8px; background:rgba(0,0,0,0.2); color:#fff; outline:none; font-size:0.75rem; font-family: Outfit, sans-serif;">
      </div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:0.75rem; color:var(--text-secondary);">Email Auto-responder Template</label>
        <select id="int-gmail-template" style="padding:10px; border:1px solid var(--border-color); border-radius:8px; background:#121826; color:#fff; outline:none; font-size:0.75rem; font-family: Outfit, sans-serif;">
          <option value="welcome">New Customer Welcome Pitch</option>
          <option value="invoice">Overdue Invoice Notice</option>
          <option value="support">Standard SLA Support Ticket Reply</option>
        </select>
      </div>
    `,
    stripe: `
      <div style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:0.75rem; color:var(--text-secondary);">Sync Event Threshold Amount ($)</label>
        <input type="number" id="int-stripe-threshold" value="100" style="padding:10px; border:1px solid var(--border-color); border-radius:8px; background:rgba(0,0,0,0.2); color:#fff; outline:none; font-size:0.75rem; font-family: Outfit, sans-serif;">
      </div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:0.75rem; color:var(--text-secondary);">Default Transaction Currency</label>
        <select id="int-stripe-currency" style="padding:10px; border:1px solid var(--border-color); border-radius:8px; background:#121826; color:#fff; outline:none; font-size:0.75rem; font-family: Outfit, sans-serif;">
          <option value="usd">USD ($)</option>
          <option value="eur">EUR (€)</option>
          <option value="gbp">GBP (£)</option>
        </select>
      </div>
    `
  };

  const genericFields = `
    <div style="display:flex; flex-direction:column; gap:4px;">
      <label style="font-size:0.75rem; color:var(--text-secondary);">Sync Data Scope</label>
      <select style="padding:10px; border:1px solid var(--border-color); border-radius:8px; background:#121826; color:#fff; outline:none; font-size:0.75rem; font-family: Outfit, sans-serif;">
        <option value="all">Full Workspace Sync</option>
        <option value="delta">Delta Incremental Sync</option>
        <option value="metadata">Metadata Headers Only</option>
      </select>
    </div>
  `;

  const btnIntTestRun = document.getElementById('btn-integration-test-run');
  const intTesterConsole = document.getElementById('integration-tester-console');
  const intTesterLogs = document.getElementById('integration-tester-logs');

  const integrationCards = document.querySelectorAll('.integration-card-large');
  integrationCards.forEach(card => {
    const title = card.querySelector('.integration-card-large-title').innerText;
    const slug = title.toLowerCase().replace(/\s+/g, '-');
    
    if (safeStorage.getItem(`integration_connected_${slug}`)) {
      card.classList.add('connected');
    }

    card.addEventListener('click', () => {
      if (!credentialsModal) return;
      
      document.getElementById('integration-target-id').value = slug;
      document.getElementById('integration-modal-title').innerText = `${title} Integration`;
      document.getElementById('integration-modal-desc').innerText = `Configure API webhook endpoints and access tokens to enable secure operations pipeline with ${title}.`;

      document.getElementById('integration-api-url').value = safeStorage.getItem(`integration_url_${slug}`) || '';
      document.getElementById('integration-api-key').value = safeStorage.getItem(`integration_key_${slug}`) || '';

      const dynamicFieldsContainer = document.getElementById('integration-dynamic-fields');
      if (dynamicFieldsContainer) {
        if (integrationFieldsMap[slug]) {
          dynamicFieldsContainer.innerHTML = integrationFieldsMap[slug];
        } else {
          dynamicFieldsContainer.innerHTML = genericFields;
        }
      }

      if (btnIntTestRun) btnIntTestRun.style.display = 'inline-flex';
      if (intTesterConsole) intTesterConsole.style.display = 'none';
      if (intTesterLogs) intTesterLogs.innerHTML = '';

      credentialsModal.classList.add('open');
    });
  });

  if (btnIntTestRun) {
    btnIntTestRun.addEventListener('click', () => {
      const slug = document.getElementById('integration-target-id').value;
      const url = document.getElementById('integration-api-url').value || `https://api.${slug}.com/v1/sync`;
      
      if (intTesterConsole) intTesterConsole.style.display = 'block';
      if (intTesterLogs) {
        intTesterLogs.innerHTML = '<div class="webhook-log-line webhook-log-info">[INFO] Initializing dynamic endpoint diagnostics...</div>';
        
        setTimeout(() => {
          intTesterLogs.innerHTML += `<div class="webhook-log-line webhook-log-info">[INFO] Resolving host target for ${slug.toUpperCase()} API service...</div>`;
          intTesterConsole.scrollTop = intTesterConsole.scrollHeight;
        }, 300);

        setTimeout(() => {
          intTesterLogs.innerHTML += `<div class="webhook-log-line webhook-log-info">[INFO] Verifying handshake payload signatures against route: ${url}</div>`;
          intTesterConsole.scrollTop = intTesterConsole.scrollHeight;
        }, 750);

        setTimeout(() => {
          intTesterLogs.innerHTML += `<div class="webhook-log-line webhook-log-info">[INFO] Executing HTTP POST ping handshake sequence...</div>`;
          intTesterConsole.scrollTop = intTesterConsole.scrollHeight;
        }, 1200);

        setTimeout(() => {
          intTesterLogs.innerHTML += `<div class="webhook-log-line webhook-log-success">[SUCCESS] Received 200 OK verification response from endpoint!</div>`;
          intTesterLogs.innerHTML += `<div class="webhook-log-line webhook-log-success">[SUCCESS] Handshake verified. Webhook secure tunnels established.</div>`;
          intTesterConsole.scrollTop = intTesterConsole.scrollHeight;
          logActivity('Integrations', `Ran connection handshake diagnostic checklist for: ${slug.toUpperCase()}`);
        }, 1700);
      }
    });
  }

  if (configCloseBtn && credentialsModal) {
    configCloseBtn.addEventListener('click', () => credentialsModal.classList.remove('open'));
  }

  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', () => {
      const slug = document.getElementById('integration-target-id').value;
      safeStorage.removeItem(`integration_connected_${slug}`);
      safeStorage.removeItem(`integration_url_${slug}`);
      safeStorage.removeItem(`integration_key_${slug}`);

      integrationCards.forEach(card => {
        const title = card.querySelector('.integration-card-large-title').innerText;
        const curSlug = title.toLowerCase().replace(/\s+/g, '-');
        if (curSlug === slug) card.classList.remove('connected');
      });

      logActivity('Integrations', `Disconnected application hooks: ${slug.toUpperCase()}`);
      if (credentialsModal) credentialsModal.classList.remove('open');
    });
  }

  if (connectionForm) {
    connectionForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const slug = document.getElementById('integration-target-id').value;
      const url = document.getElementById('integration-api-url').value;
      const key = document.getElementById('integration-api-key').value;

      safeStorage.setItem(`integration_connected_${slug}`, 'true');
      safeStorage.setItem(`integration_url_${slug}`, url);
      safeStorage.setItem(`integration_key_${slug}`, key);

      integrationCards.forEach(card => {
        const title = card.querySelector('.integration-card-large-title').innerText;
        const curSlug = title.toLowerCase().replace(/\s+/g, '-');
        if (curSlug === slug) card.classList.add('connected');
      });

      logActivity('Integrations', `Established secure API validation credentials: ${slug.toUpperCase()}`);
      if (credentialsModal) credentialsModal.classList.remove('open');
      alert(`Integration connection established! Webhooks routed successfully.`);
    });
  }

  // -------------------------------------------------------------
  // 11. Integrations Grid Filter (Panel 7)
  // -------------------------------------------------------------
  const filterPillBtns = document.querySelectorAll('.filter-pill-btn');

  if (filterPillBtns && integrationCards) {
    filterPillBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterPillBtns.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.dataset.filter;
        integrationCards.forEach(card => {
          if (filter === 'all' || card.dataset.cat === filter) {
            card.classList.remove('hidden');
          } else {
            card.classList.add('hidden');
          }
        });
        logActivity('Integrations Grid', `Filtered integrations by category: ${filter}`);
      });
    });
  }

  // -------------------------------------------------------------
  // 12. Advanced Features Modal Map (Panel 9) & Overlay Cards
  // -------------------------------------------------------------
  const advFeatureCards = document.querySelectorAll('.adv-feature-card');
  const infoModal = document.getElementById('info-modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body-content');
  const modalIcon = document.getElementById('modal-icon');

  if (advFeatureCards && infoModal) {
    advFeatureCards.forEach(card => {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        const tool = card.dataset.tool;
        const title = card.querySelector('h3').innerText;
        
        modalTitle.innerText = title;
        modalIcon.innerHTML = `<i class="${card.querySelector('i').className}"></i>`;

        injectAdvancedToolUI(tool);
        infoModal.classList.add('open');
      });
    });
  }

  function injectAdvancedToolUI(tool) {
    if (tool === 'co-pilot') {
      modalBody.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px; text-align:left;">
          <p style="font-size:0.75rem; color:var(--text-secondary);">Input text drafts or raw developer code blocks to get styling suggestions.</p>
          <textarea id="copilot-input" rows="4" placeholder="e.g. Write a javascript class to handle theme changes..." style="width:100%; font-size:0.75rem; padding:8px;"></textarea>
          <button type="button" class="btn-primary" id="btn-copilot-run" style="justify-content:center;">Synthesize Revisions</button>
          <div id="copilot-output" style="display:none; padding:10px; background:#05070f; border:1px solid var(--border-color); color:#c084fc; border-radius:6px; font-family:monospace; font-size:0.65rem; max-height:150px; overflow:auto;"></div>
        </div>
      `;
      document.getElementById('btn-copilot-run').addEventListener('click', () => {
        const output = document.getElementById('copilot-output');
        output.style.display = 'block';
        output.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Auto-routing revisions...';
        setTimeout(() => {
          output.innerText = `class ThemeEngine {\n  constructor(mode) {\n    this.mode = mode;\n    document.body.classList.toggle('light-theme', mode === 'light');\n  }\n}`;
          logActivity('Co-Pilot', 'Synthesized script logic revisions.');
        }, 800);
      });
    } else if (tool === 'autonomous') {
      modalBody.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px; text-align:left;">
          <p style="font-size:0.75rem; color:var(--text-secondary);">Autonomous background processes listening for metric fluctuations.</p>
          <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:8px; font-size:0.7rem; display:flex; flex-direction:column; gap:6px;">
            <div style="display:flex; justify-content:space-between;"><span>Trigger Metric:</span><strong>Revenue SLA</strong></div>
            <div style="display:flex; justify-content:space-between;"><span>Threshold Alert:</span><strong>&lt; 99% Uptime</strong></div>
            <div style="display:flex; justify-content:space-between;"><span>Action Workflow:</span><strong>Send Slack Alert</strong></div>
          </div>
          <button type="button" class="btn-primary" id="btn-auto-loop" style="justify-content:center;">Trigger Simulation Loop</button>
        </div>
      `;
      document.getElementById('btn-auto-loop').addEventListener('click', () => {
        alert("Simulation pipeline active. Telemetry logs will update logs if variables cross thresholds.");
        logActivity('Autonomous Agent', 'Triggered background pipeline audits check.');
      });
    } else if (tool === 'meeting') {
      modalBody.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px; text-align:left;">
          <p style="font-size:0.75rem; color:var(--text-secondary);">Paste raw meeting transcript blocks to extract summaries and bullet task lists.</p>
          <textarea id="meeting-input" rows="4" placeholder="Varaprasad: Let's remove the pricing tier card. Developers: Understood." style="width:100%; font-size:0.75rem; padding:8px;"></textarea>
          <button type="button" class="btn-primary" id="btn-meeting-run" style="justify-content:center;">Extract Meeting SLA</button>
          <div id="meeting-output" style="display:none; padding:10px; background:rgba(16,185,129,0.05); border:1px solid var(--color-success); border-radius:8px; font-size:0.7rem; color:#fff;"></div>
        </div>
      `;
      document.getElementById('btn-meeting-run').addEventListener('click', () => {
        const output = document.getElementById('meeting-output');
        output.style.display = 'block';
        output.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Filtering dialogue segments...';
        setTimeout(() => {
          output.innerHTML = `<strong>Summary:</strong> Aligned on removing enterprise pricing layers.<br><strong>Action:</strong> Update index.html menu list.`;
          logActivity('Meeting Notes', 'Parsed transcript summaries.');
        }, 800);
      });
    } else if (tool === 'email') {
      modalBody.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px; text-align:left;">
          <label style="font-size:0.65rem; color:var(--text-secondary);">Recipient Type</label>
          <input type="text" id="email-to" placeholder="e.g. Prospective Client" style="font-size:0.75rem; padding:8px;">
          <label style="font-size:0.65rem; color:var(--text-secondary);">Email Topic</label>
          <input type="text" id="email-topic" placeholder="e.g. Schedule design demo call" style="font-size:0.75rem; padding:8px;">
          <button type="button" class="btn-primary" id="btn-email-run" style="justify-content:center; margin-top:4px;">Draft Pitch Email</button>
          <div id="email-output-wrapper" style="display:none; flex-direction:column; gap:6px; margin-top:4px;">
            <textarea id="email-output" rows="5" style="width:100%; font-size:0.7rem; padding:8px; background:#05070f; border:1px solid var(--border-color); color:#fff;"></textarea>
            <button type="button" class="btn-secondary" id="btn-email-copy" style="font-size:0.65rem; justify-content:center;">Copy to Clipboard</button>
          </div>
        </div>
      `;
      document.getElementById('btn-email-run').addEventListener('click', () => {
        const to = document.getElementById('email-to').value || 'Client';
        const topic = document.getElementById('email-topic').value || 'SaaS update';
        const wrapper = document.getElementById('email-output-wrapper');
        const output = document.getElementById('email-output');
        wrapper.style.display = 'flex';
        output.value = `Subject: Quick Question regarding ${topic}\n\nHi ${to},\n\nI wanted to share that we just launched NexusHub AI v3.0, updating operational workflows. Let's schedule a call.\n\nBest,\nNexusHub AI Team`;
        
        document.getElementById('btn-email-copy').addEventListener('click', () => {
          output.select();
          document.execCommand('copy');
          alert("Email text copied to clipboard!");
        });
      });
    } else if (tool === 'voice') {
      modalBody.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px; text-align:center;">
          <p style="font-size:0.75rem; color:var(--text-secondary); text-align:left;">Click the mic to speak dashboard command parameters aloud (e.g. "Toggle Light Mode").</p>
          <div style="width:60px; height:60px; border-radius:50%; background:var(--color-primary); display:inline-flex; align-items:center; justify-content:center; margin:10px auto; cursor:pointer;" id="voice-assistant-mic-trigger">
            <i class="fa-solid fa-microphone" style="font-size:1.8rem; color:#fff;"></i>
          </div>
          <div id="voice-assistant-txt" style="font-size:0.72rem; color:var(--text-muted);">Click to speak command prompt</div>
        </div>
      `;
      const trigger = document.getElementById('voice-assistant-mic-trigger');
      const txt = document.getElementById('voice-assistant-txt');
      trigger.addEventListener('click', () => {
        trigger.style.background = 'var(--color-danger)';
        txt.innerText = 'Listening to command parameters...';
        setTimeout(() => {
          trigger.style.background = 'var(--color-primary)';
          txt.innerHTML = `Command Captured: <strong>"Toggle Light Mode"</strong>`;
          const btn = document.getElementById('btn-toggle-theme');
          if (btn) btn.click();
        }, 1800);
      });
    } else if (tool === 'analyzer') {
      modalBody.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px; text-align:left;">
          <p style="font-size:0.75rem; color:var(--text-secondary);">Input spreadsheet figures separated by commas to compile bar charts.</p>
          <input type="text" id="analyzer-data" placeholder="e.g. 12, 19, 3, 5, 2, 3" style="font-size:0.75rem; padding:8px;">
          <button type="button" class="btn-primary" id="btn-analyzer-run" style="justify-content:center;">Synthesize Chart</button>
          <div style="height:120px; display:none; margin-top:8px;" id="analyzer-chart-container">
            <canvas id="analyzer-modal-chart"></canvas>
          </div>
        </div>
      `;
      let chartObj = null;
      document.getElementById('btn-analyzer-run').addEventListener('click', () => {
        const val = document.getElementById('analyzer-data').value || '12, 19, 3, 5, 2, 3';
        const numArr = val.split(',').map(n => parseInt(n.trim()) || 0);
        const container = document.getElementById('analyzer-chart-container');
        container.style.display = 'block';

        const canvas = document.getElementById('analyzer-modal-chart');
        
        // Remove previous visual fallback if any
        const oldFb = container.querySelector('.chart-fallback-render');
        if (oldFb) oldFb.remove();

        if (typeof Chart === 'undefined') {
          console.warn("ChartJS library not loaded. Creating visual bar fallback.");
          canvas.style.display = 'none';
          const maxVal = Math.max(...numArr, 1);
          let barsHtml = `<div style="display:flex; align-items:flex-end; justify-content:space-around; height:100%; width:100%; padding-top:10px; border-bottom:1px solid rgba(255,255,255,0.1);">`;
          numArr.forEach((num, i) => {
            const pct = (num / maxVal) * 100;
            barsHtml += `
              <div style="display:flex; flex-direction:column; align-items:center; flex-grow:1; max-width:40px; height:100%;">
                <div style="font-size:0.6rem; color:#fff; margin-bottom:4px;">${num}</div>
                <div style="width:20px; height:${pct}%; background:#06b6d4; border-radius:3px 3px 0 0;"></div>
                <div style="font-size:0.6rem; color:var(--text-secondary); margin-top:4px;">Val ${i+1}</div>
              </div>
            `;
          });
          barsHtml += `</div>`;
          
          const fbDiv = document.createElement('div');
          fbDiv.className = 'chart-fallback-render';
          fbDiv.style.height = '100%';
          fbDiv.innerHTML = barsHtml;
          container.appendChild(fbDiv);
        } else {
          canvas.style.display = 'block';
          if (chartObj) chartObj.destroy();
          chartObj = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
              labels: numArr.map((_, i) => `Val ${i+1}`),
              datasets: [{ data: numArr, backgroundColor: '#06b6d4', borderRadius: 4 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
          });
        }
        logActivity('Data Analyzer', 'Compiled customized analysis bar charts.');
      });
    } else if (tool === 'summarizer') {
      modalBody.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px; text-align:left;">
          <p style="font-size:0.75rem; color:var(--text-secondary);">Input long paragraphs of reference strategies to summarize details.</p>
          <textarea id="summarizer-input" rows="4" placeholder="Paste copy block here..." style="width:100%; font-size:0.75rem; padding:8px;"></textarea>
          <button type="button" class="btn-primary" id="btn-summarizer-run" style="justify-content:center;">Condense Text</button>
          <div id="summarizer-output" style="display:none; padding:10px; background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:6px; font-size:0.7rem; color:var(--text-secondary);"></div>
        </div>
      `;
      document.getElementById('btn-summarizer-run').addEventListener('click', () => {
        const output = document.getElementById('summarizer-output');
        output.style.display = 'block';
        output.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Condensing sentence chains...';
        setTimeout(() => {
          output.innerHTML = `• System launch benchmarked with GIS Auth integrations.<br>• Removed old Firebase configuration overlays.`;
          logActivity('Summarizer', 'Drafted condensed executive bullet lists.');
        }, 800);
      });
    } else if (tool === 'forecaster') {
      modalBody.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px; text-align:left;">
          <p style="font-size:0.75rem; color:var(--text-secondary);">Adjust predicted sales growth Retainer multiplier to compute revenue margins.</p>
          <div style="display:flex; align-items:center; gap:12px;">
            <input type="range" id="forecast-range" min="1" max="5" step="0.5" value="1.5" style="flex-grow:1;">
            <span style="font-size:0.8rem; font-weight:700;" id="forecast-val">1.5x</span>
          </div>
          <button type="button" class="btn-primary" id="btn-forecast-run" style="justify-content:center;">Chart Predictive forecast</button>
          <div style="height:120px; display:none; margin-top:8px;" id="forecast-chart-container">
            <canvas id="forecast-modal-chart"></canvas>
          </div>
        </div>
      `;
      let chartObj = null;
      const range = document.getElementById('forecast-range');
      const label = document.getElementById('forecast-val');
      range.addEventListener('input', () => { label.innerText = `${range.value}x`; });

      document.getElementById('btn-forecast-run').addEventListener('click', () => {
        const mult = parseFloat(range.value);
        const container = document.getElementById('forecast-chart-container');
        container.style.display = 'block';

        const canvas = document.getElementById('forecast-modal-chart');
        
        // Remove previous fallback if any
        const oldFb = container.querySelector('.chart-fallback-render');
        if (oldFb) oldFb.remove();

        if (typeof Chart === 'undefined') {
          console.warn("ChartJS library not loaded. Creating visual forecast fallback.");
          canvas.style.display = 'none';
          const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
          const vals = [12000 * mult, 15000 * mult, 18000 * mult, 22000 * mult, 29000 * mult];
          const maxVal = Math.max(...vals, 1);
          
          let barsHtml = `<div style="display:flex; align-items:flex-end; justify-content:space-around; height:100%; width:100%; padding-top:10px; border-bottom:1px solid rgba(255,255,255,0.1);">`;
          vals.forEach((val, i) => {
            const pct = (val / maxVal) * 100;
            barsHtml += `
              <div style="display:flex; flex-direction:column; align-items:center; flex-grow:1; max-width:50px; height:100%;">
                <div style="font-size:0.6rem; color:#fff; margin-bottom:4px;">$${Math.round(val/1000)}k</div>
                <div style="width:10px; height:${pct}%; background:#ec4899; border-radius:3px 3px 0 0;"></div>
                <div style="font-size:0.6rem; color:var(--text-secondary); margin-top:4px;">${months[i]}</div>
              </div>
            `;
          });
          barsHtml += `</div>`;
          
          const fbDiv = document.createElement('div');
          fbDiv.className = 'chart-fallback-render';
          fbDiv.style.height = '100%';
          fbDiv.innerHTML = barsHtml;
          container.appendChild(fbDiv);
        } else {
          canvas.style.display = 'block';
          if (chartObj) chartObj.destroy();
          chartObj = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
              labels: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov'],
              datasets: [{ data: [12000 * mult, 15000 * mult, 18000 * mult, 22000 * mult, 29000 * mult], borderColor: '#ec4899', fill: false }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
          });
        }
        logActivity('Forecaster', 'Generated linear regression forecasting analytics models.');
      });
    } else if (tool === 'translator') {
      modalBody.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px; text-align:left;">
          <textarea id="translate-input" rows="3" placeholder="Enter English text to translate..." style="width:100%; font-size:0.75rem; padding:8px;"></textarea>
          <div style="display:flex; gap:10px; align-items:center;">
            <select id="translate-lang" style="font-size:0.75rem; padding:6px; flex-grow:1;">
              <option value="es">Spanish (Español)</option>
              <option value="fr">French (Français)</option>
              <option value="te">Telugu (తెలుగు)</option>
              <option value="de">German (Deutsch)</option>
            </select>
            <button type="button" class="btn-primary" id="btn-translate-run">Translate</button>
          </div>
          <div id="translate-output" style="display:none; padding:10px; background:#05070f; border:1px solid var(--border-color); color:#fff; border-radius:6px; font-size:0.75rem;"></div>
        </div>
      `;
      document.getElementById('btn-translate-run').addEventListener('click', () => {
        const text = document.getElementById('translate-input').value;
        const lang = document.getElementById('translate-lang').value;
        const output = document.getElementById('translate-output');
        output.style.display = 'block';
        output.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Translating...';
        setTimeout(() => {
          let trans = "Hola, bienvenido al portal NexusHub.";
          if (lang === 'fr') trans = "Bonjour, bienvenue sur le portail NexusHub.";
          else if (lang === 'te') trans = "నమస్కారం, నెక్సస్ హబ్ పోర్టల్ కు స్వాగతం.";
          else if (lang === 'de') trans = "Hallo, willkommen im NexusHub Portal.";
          output.innerText = trans;
          logActivity('Translator', 'Processed multilanguage translate blocks.');
        }, 600);
      });
    }
  }

  // Bind close buttons for Advanced feature modal
  const infoModalCloseBtn = document.getElementById('modal-close-btn');
  if (infoModalCloseBtn && infoModal) {
    infoModalCloseBtn.addEventListener('click', () => infoModal.classList.remove('open'));
  }

  // -------------------------------------------------------------
  // 13. Settings & Customization Control bindings
  // -------------------------------------------------------------
  const btnToggleTheme = document.getElementById('btn-toggle-theme');
  const btnSettingsSave = document.getElementById('btn-settings-save');
  const btnSettingsReset = document.getElementById('btn-settings-reset');

  // Sliders mapping values logic
  const settingsTemp = document.getElementById('settings-temp');
  const settingsTempVal = document.getElementById('settings-temp-val');
  if (settingsTemp && settingsTempVal) {
    settingsTemp.addEventListener('input', () => { settingsTempVal.innerText = settingsTemp.value; });
  }

  const settingsMaxTokens = document.getElementById('settings-max-tokens');
  const settingsTokensVal = document.getElementById('settings-tokens-val');
  if (settingsMaxTokens && settingsTokensVal) {
    settingsMaxTokens.addEventListener('input', () => { settingsTokensVal.innerText = settingsMaxTokens.value; });
  }

  const settingsVolume = document.getElementById('settings-tts-volume');
  const settingsVolVal = document.getElementById('settings-vol-val');
  if (settingsVolume && settingsVolVal) {
    settingsVolume.addEventListener('input', () => { settingsVolVal.innerText = `${Math.round(settingsVolume.value * 100)}%`; });
  }

  const settingsRate = document.getElementById('settings-tts-rate');
  const settingsRateVal = document.getElementById('settings-rate-val');
  if (settingsRate && settingsRateVal) {
    settingsRate.addEventListener('input', () => { settingsRateVal.innerText = `${parseFloat(settingsRate.value).toFixed(1)}x`; });
  }

  const settingsPitch = document.getElementById('settings-tts-pitch');
  const settingsPitchVal = document.getElementById('settings-pitch-val');
  if (settingsPitch && settingsPitchVal) {
    settingsPitch.addEventListener('input', () => { settingsPitchVal.innerText = parseFloat(settingsPitch.value).toFixed(1); });
  }

  const settingsAtsWeight = document.getElementById('settings-resume-ats-weight');
  const settingsWeightVal = document.getElementById('settings-weight-val');
  if (settingsAtsWeight && settingsWeightVal) {
    settingsAtsWeight.addEventListener('input', () => { settingsWeightVal.innerText = `${settingsAtsWeight.value}%`; });
  }

  // Theme Toggler
  if (btnToggleTheme) {
    btnToggleTheme.addEventListener('click', () => {
      const isLight = body.classList.toggle('light-theme');
      btnToggleTheme.innerHTML = isLight ? '<i class="fa-solid fa-sun"></i> <span>Light Mode</span>' : '<i class="fa-solid fa-moon"></i> <span>Dark Mode</span>';
      safeStorage.setItem('settings_theme', isLight ? 'light' : 'dark');
      logActivity('System', `Visual theme switched to: ${isLight ? 'Light Theme' : 'Dark Theme'}`);
    });

    // Check saved theme
    if (safeStorage.getItem('settings_theme') === 'light') {
      body.classList.add('light-theme');
      btnToggleTheme.innerHTML = '<i class="fa-solid fa-sun"></i> <span>Light Mode</span>';
    }
  }

  // Populates Synthesis Voices in Settings Select dropdown
  function populateSynthesisVoices() {
    const voiceSelect = document.getElementById('settings-tts-voice');
    if (!voiceSelect || !('speechSynthesis' in window)) return;

    const voices = window.speechSynthesis.getVoices();
    voiceSelect.innerHTML = '<option value="default">Default System Reader</option>';
    
    voices.forEach((voice, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.innerText = `${voice.name} (${voice.lang})`;
      voiceSelect.appendChild(option);
    });
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = populateSynthesisVoices;
    populateSynthesisVoices();
  }

  // Load Settings from LocalStorage if existing
  function loadStoredSettings() {
    const saved = safeStorage.getItem('hub_settings');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.model) document.getElementById('settings-ai-model').value = s.model;
        if (s.temp) {
          document.getElementById('settings-temp').value = s.temp;
          settingsTempVal.innerText = s.temp;
        }
        if (s.tokens) {
          document.getElementById('settings-max-tokens').value = s.tokens;
          settingsTokensVal.innerText = s.tokens;
        }
        if (s.prompt) document.getElementById('settings-system-prompt').value = s.prompt;
        if (s.voice) document.getElementById('settings-tts-voice').value = s.voice;
        if (s.volume) {
          document.getElementById('settings-tts-volume').value = s.volume;
          settingsVolVal.innerText = `${Math.round(s.volume * 100)}%`;
        }
        if (s.rate) {
          document.getElementById('settings-tts-rate').value = s.rate;
          settingsRateVal.innerText = `${parseFloat(s.rate).toFixed(1)}x`;
        }
        if (s.pitch) {
          document.getElementById('settings-tts-pitch').value = s.pitch;
          settingsPitchVal.innerText = parseFloat(s.pitch).toFixed(1);
        }
        if (s.speechRec !== undefined) document.getElementById('settings-enable-speech-rec').checked = s.speechRec;
        if (s.telemetry) document.getElementById('settings-telemetry-interval').value = s.telemetry;
        if (s.autosave) document.getElementById('settings-autosave-interval').value = s.autosave;
        if (s.storage) document.getElementById('settings-storage-strategy').value = s.storage;
        if (s.logLevel) document.getElementById('settings-log-level').value = s.logLevel;
        if (s.currency) document.getElementById('settings-currency').value = s.currency;
        if (s.alert) document.getElementById('settings-alert-type').value = s.alert;
        if (s.atsWeight) {
          document.getElementById('settings-resume-ats-weight').value = s.atsWeight;
          settingsWeightVal.innerText = `${s.atsWeight}%`;
        }
        if (s.vault) document.getElementById('settings-api-key-vault').value = s.vault;
        if (s.googleClientId) document.getElementById('settings-google-client-id').value = s.googleClientId;
      } catch (err) {}
    }
  }
  loadStoredSettings();

  // Save Settings
  if (btnSettingsSave) {
    btnSettingsSave.addEventListener('click', () => {
      const s = {
        model: document.getElementById('settings-ai-model').value,
        temp: document.getElementById('settings-temp').value,
        tokens: document.getElementById('settings-max-tokens').value,
        prompt: document.getElementById('settings-system-prompt').value,
        voice: document.getElementById('settings-tts-voice').value,
        volume: document.getElementById('settings-tts-volume').value,
        rate: document.getElementById('settings-tts-rate').value,
        pitch: document.getElementById('settings-tts-pitch').value,
        speechRec: document.getElementById('settings-enable-speech-rec').checked,
        telemetry: document.getElementById('settings-telemetry-interval').value,
        autosave: document.getElementById('settings-autosave-interval').value,
        storage: document.getElementById('settings-storage-strategy').value,
        logLevel: document.getElementById('settings-log-level').value,
        currency: document.getElementById('settings-currency').value,
        alert: document.getElementById('settings-alert-type').value,
        atsWeight: document.getElementById('settings-resume-ats-weight').value,
        vault: document.getElementById('settings-api-key-vault').value,
        googleClientId: document.getElementById('settings-google-client-id').value
      };

      safeStorage.setItem('hub_settings', JSON.stringify(s));
      logActivity('System', 'Saved configuration parameters into LocalStorage vault.');
      if (window.initGoogleAuth) window.initGoogleAuth(true);
      alert("Settings saved successfully!");
    });
  }

  // Reset Settings
  if (btnSettingsReset) {
    btnSettingsReset.addEventListener('click', () => {
      safeStorage.removeItem('hub_settings');
      alert("Settings restored to system defaults!");
      window.location.reload();
    });
  }

  // -------------------------------------------------------------
  // 14. Advanced Features Modal Map redirect trigger
  // -------------------------------------------------------------
  const btnViewAllFeatures = document.getElementById('btn-view-all-features');
  const featuresModalOverlay = document.getElementById('features-modal-overlay');
  const featuresModalCloseBtn = document.getElementById('features-modal-close-btn');

  if (btnViewAllFeatures && featuresModalOverlay) {
    btnViewAllFeatures.addEventListener('click', () => {
      featuresModalOverlay.classList.add('open');
      logActivity('System', 'Opened Enterprise Platform Capabilities Map.');
    });
  }

  if (featuresModalCloseBtn && featuresModalOverlay) {
    featuresModalCloseBtn.addEventListener('click', () => {
      featuresModalOverlay.classList.remove('open');
    });
  }

  if (featuresModalOverlay) {
    featuresModalOverlay.addEventListener('click', (e) => {
      if (e.target === featuresModalOverlay) {
        featuresModalOverlay.classList.remove('open');
      }
    });
  }

  // -------------------------------------------------------------
  // 15. Responsive Mobile Drawer Toggles (Screens <= 992px)
  // -------------------------------------------------------------
  const btnMobileMenuToggle = document.getElementById('btn-mobile-menu-toggle');
  const sidebarDock = document.querySelector('.sidebar-dock');

  if (btnMobileMenuToggle && sidebarDock) {
    btnMobileMenuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebarDock.classList.toggle('mobile-open');
    });

    // Close drawer menu if clicking in general workspace elements
    document.addEventListener('click', (e) => {
      if (sidebarDock.classList.contains('mobile-open')) {
        if (!sidebarDock.contains(e.target) && e.target !== btnMobileMenuToggle) {
          sidebarDock.classList.remove('mobile-open');
        }
      }
    });

    // Close drawer menu on click of dock navigation buttons
    const dockButtons = document.querySelectorAll('.dock-item-btn');
    dockButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        sidebarDock.classList.remove('mobile-open');
      });
    });
  }

  // -------------------------------------------------------------
  // 17. AI App Store & Plugin Workspace Logic
  // -------------------------------------------------------------
  const pluginModal = document.getElementById('plugin-workspace-modal');
  const pluginCloseBtn = document.getElementById('plugin-modal-close-btn');
  const pluginIcon = document.getElementById('plugin-modal-icon');
  const pluginTitle = document.getElementById('plugin-modal-title');
  const pluginDesc = document.getElementById('plugin-modal-desc');
  const pluginInputs = document.getElementById('plugin-workspace-inputs');
  const pluginActions = document.getElementById('plugin-workspace-actions');
  const pluginOutputContainer = document.getElementById('plugin-workspace-output-container');
  const pluginOutput = document.getElementById('plugin-workspace-output');
  const btnPluginCopy = document.getElementById('btn-plugin-copy');

  // Close modal listeners
  if (pluginCloseBtn && pluginModal) {
    pluginCloseBtn.addEventListener('click', () => pluginModal.classList.remove('open'));
  }
  if (pluginModal) {
    pluginModal.addEventListener('click', (e) => {
      if (e.target === pluginModal) pluginModal.classList.remove('open');
    });
  }

  // Copy output to clipboard
  if (btnPluginCopy && pluginOutput) {
    btnPluginCopy.addEventListener('click', () => {
      navigator.clipboard.writeText(pluginOutput.textContent).then(() => {
        logActivity('App Store', 'Copied plugin output to clipboard.');
        const originalText = btnPluginCopy.innerHTML;
        btnPluginCopy.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        setTimeout(() => {
          btnPluginCopy.innerHTML = originalText;
        }, 1500);
      }).catch(err => {
        console.error('Failed to copy text: ', err);
      });
    });
  }

  const pluginsData = {
    'seo-opt': {
      title: 'AI SEO Optimizer',
      desc: 'Inject high-volume semantic keywords and auto-generate meta tag descriptors.',
      icon: 'fa-bullseye',
      inputs: [
        { id: 'keyword', label: 'Target Keyword / Brand Name', type: 'text', placeholder: 'e.g. NexusHub AI', default: 'NexusHub AI' },
        { id: 'industry', label: 'Industry Vertical', type: 'select', options: ['SaaS', 'E-Commerce', 'Healthcare', 'Finance', 'EdTech'], default: 'SaaS' }
      ],
      action: 'Run SEO Optimizer',
      run: (vals) => {
        const kw = vals.keyword || 'NexusHub AI';
        const ind = vals.industry || 'SaaS';
        return `[NexusHub AI Optimizer] Starting SEO Audit...
Target Keyword: ${kw}
Industry: ${ind}

--- RECOMMENDED META TAGS ---
<title>${kw} - The Smartest All-In-One AI Workspace & Agent Orchestration</title>
<meta name="description" content="NexusHub AI orchestrates custom agents, voice synthesis, analytics, and 20+ plugins in a single secure, responsive workspace. Boost productivity today.">

--- LSI KEYWORDS ---
1. AI agency hub (Search Vol: 18,200/mo)
2. autonomous agent dashboard (Search Vol: 5,400/mo)
3. automated web browser workspace (Search Vol: 3,200/mo)
4. corporate AI voice cloner (Search Vol: 1,900/mo)

--- SEO SCORE: 98/100 ---`;
      }
    },
    'sentiment': {
      title: 'AI Sentiment Analyzer',
      desc: 'Audit social media feedback and reviews to score positive/negative splits.',
      icon: 'fa-face-smile',
      inputs: [
        { id: 'review', label: 'Feedback Review Text', type: 'textarea', placeholder: 'Enter feedback...', default: 'This new workspace is absolutely incredible. It makes custom bots and auth processes run so fast, although the voice synthesis rates could be a little bit more adjustable. overall 4.5 stars!' }
      ],
      action: 'Analyze Sentiment',
      run: (vals) => {
        return `[NexusHub Sentiment AI] Parsing textual content...
Analyzing tokens and emotional weights...

--- SENTIMENT SCORE ---
Positive: 88%
Neutral: 7%
Negative: 5%

--- DETECTED KEY PHRASES ---
- "absolutely incredible" (Weight: +0.95)
- "run so fast" (Weight: +0.80)
- "synthesis rates could be more adjustable" (Weight: -0.15)

Conclusion: Highly Positive. The user loves the workspace performance but requests finer controls on audio playback speed.`;
      }
    },
    'code-refactor': {
      title: 'AI Code Refactoring',
      desc: 'Optimize, document, and analyze JavaScript/Python scripts for efficiency.',
      icon: 'fa-laptop-code',
      inputs: [
        { id: 'lang', label: 'Programming Language', type: 'select', options: ['JavaScript', 'Python', 'HTML/CSS'], default: 'JavaScript' },
        { id: 'code', label: 'Source Code Block', type: 'textarea', placeholder: 'Paste code here...', default: 'function calculateTotal(p, q) { var total = 0; for(var i=0; i<p.length; i++) { total = total + p[i]*q; } return total; }' }
      ],
      action: 'Optimize & Document',
      run: (vals) => {
        const lang = vals.lang || 'JavaScript';
        return `[NexusHub Refactoring Engine] Analyzing script syntax...
Language: ${lang}
Issues found: Var declarations (hoisting risks), classic loop can be simplified, lacks documentation.

--- REFACTORED CODE ---
/**
 * Calculates the total price for a list of item prices and a fixed multiplier.
 * @param {number[]} prices - Array of individual item prices.
 * @param {number} multiplier - Value multiplier.
 * @returns {number} The total calculated sum.
 */
const calculateTotal = (prices, multiplier) => {
  return prices.reduce((sum, price) => sum + (price * multiplier), 0);
};

--- PERFORMANCE ANALYSIS ---
- Time Complexity: O(n)
- Space Complexity: O(1)
- Clean Code Standards: ES6 Arrow function, Array.prototype.reduce, strict typing checks.`;
      }
    },
    'logo-gen': {
      title: 'AI Logo Generator',
      desc: 'Generate custom branded vector assets and base64 inline SVG logos.',
      icon: 'fa-palette',
      inputs: [
        { id: 'initials', label: 'Brand Initials', type: 'text', placeholder: 'e.g. NH', default: 'NH' },
        { id: 'color', label: 'Primary Brand Color', type: 'select', options: ['Vibrant Violet (#8b5cf6)', 'Ocean Blue (#0284c7)', 'Emerald Green (#10b981)', 'Neon Orange (#f97316)'], default: 'Vibrant Violet (#8b5cf6)' },
        { id: 'shape', label: 'Outer Vector Shape', type: 'select', options: ['Hexagon', 'Circle', 'Shield'], default: 'Hexagon' }
      ],
      action: 'Generate SVG Asset',
      run: (vals) => {
        const init = vals.initials || 'NH';
        const colorVal = (vals.color || '#8b5cf6').match(/\(.*\)/) ? (vals.color || '#8b5cf6').match(/\(([^)]+)\)/)[1] : '#8b5cf6';
        const shape = vals.shape || 'Hexagon';
        let svgShape = `<polygon points="50,5 90,25 90,75 50,95 10,75 10,25" fill="none" stroke="${colorVal}" stroke-width="4"/>`;
        if (shape === 'Circle') {
          svgShape = `<circle cx="50" cy="50" r="45" fill="none" stroke="${colorVal}" stroke-width="4"/>`;
        } else if (shape === 'Shield') {
          svgShape = `<path d="M10,10 L50,5 L90,10 L90,50 C90,75 50,95 50,95 C50,95 10,75 10,50 Z" fill="none" stroke="${colorVal}" stroke-width="4"/>`;
        }
        return `[NexusHub Creative AI] Synthesizing vector nodes...
Brand Initials: ${init}
Color Theme: ${colorVal}
Shape: ${shape}

--- SVG CODE GENERATED ---
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="120" height="120">
  ${svgShape}
  <text x="50" y="58" font-family="'Outfit', sans-serif" font-size="28" font-weight="bold" fill="#fff" text-anchor="middle">${init}</text>
  <circle cx="50" cy="80" r="4" fill="#a7f3d0"/>
</svg>

(Copy Output to clipboard to embed inside your HTML projects)`;
      }
    },
    'sql-builder': {
      title: 'AI SQL Builder',
      desc: 'Convert natural English queries into fully formatted PostgreSQL database scripts.',
      icon: 'fa-database',
      inputs: [
        { id: 'table', label: 'Primary Target Table', type: 'text', placeholder: 'e.g. users', default: 'users' },
        { id: 'query', label: 'Query Goal Description', type: 'text', placeholder: 'e.g. find all users...', default: 'find all users who registered after 2026-01-01 and spent more than $500, sorted by total spent' }
      ],
      action: 'Compile PostgreSQL Query',
      run: (vals) => {
        const tbl = vals.table || 'users';
        const q = vals.query || '';
        return `-- [NexusHub SQL Compiler v1.2]
-- Input: ${q}

SELECT 
  id, 
  name, 
  email, 
  registration_date, 
  total_spent 
FROM 
  ${tbl} 
WHERE 
  registration_date > '2026-01-01'::DATE 
  AND total_spent > 500.00
ORDER BY 
  total_spent DESC;

-- Index suggestion: CREATE INDEX idx_${tbl}_date_spent ON ${tbl}(registration_date, total_spent);`;
      }
    },
    'nda-reviewer': {
      title: 'AI NDA Reviewer',
      desc: 'Audit confidentiality agreements for risky terms and security liability scores.',
      icon: 'fa-file-shield',
      inputs: [
        { id: 'nda', label: 'NDA / Agreement Text Copy', type: 'textarea', placeholder: 'Paste clause...', default: 'Party A agrees that they shall not disclose any trade secrets. Any violation will result in a penalty of $10,000,000, payable immediately without any legal trial, and all IP ownership of Party A will automatically transfer to Party B permanently.' }
      ],
      action: 'Audit Agreement Clauses',
      run: (vals) => {
        return `[NexusHub Legal AI] Auditing agreement text...
Risk Rating: CRITICAL (95/100)

--- RISK BREAKDOWN ---
1. Unreasonable penalty ($10,000,000 penalty without legal trial)
   - Severity: High Risk
   - Action: Replace with mutual actual damages clause.

2. Automatic IP Transfer
   - Severity: Critical Risk
   - Action: Clause forces complete asset transfer on minor breach. Strike out.

3. Unbalanced Confidentiality
   - Severity: Medium Risk
   - Action: Make obligations mutual for both parties.`;
      }
    },
    'voice-cloner': {
      title: 'AI Voice Cloner',
      desc: 'Select pitch, rate, and gender options to synthesize customized cloned vocal scripts.',
      icon: 'fa-microphone-lines',
      inputs: [
        { id: 'gender', label: 'Voice Gender Model', type: 'select', options: ['Male', 'Female'], default: 'Female' },
        { id: 'accent', label: 'Cloned Vocal Accent', type: 'select', options: ['US Professional', 'UK Royal', 'Aussie Casual', 'Indian Tech-Lead'], default: 'UK Royal' },
        { id: 'pitch', label: 'Acoustic Pitch Profile', type: 'select', options: ['Low Base', 'Standard Medium', 'High Crisp'], default: 'Standard Medium' },
        { id: 'script', label: 'Playback Script Content', type: 'textarea', placeholder: 'Enter voice lines...', default: 'Welcome to the future of multi-agent operations with NexusHub AI. Cloned voice is active.' }
      ],
      action: 'Synthesize Vocal Print',
      run: (vals) => {
        const gender = vals.gender || 'Female';
        const accent = vals.accent || 'UK Royal';
        const pitch = vals.pitch || 'Standard Medium';
        return `[NexusHub Voice Cloner] Synthesizing acoustic footprint...
Gender: ${gender}
Accent: ${accent}
Pitch: ${pitch}

--- AUDIO SYNTHESIS COMPLETED ---
Target Sample Rate: 48,000 Hz
Cloning Similarity Index: 99.4%
Latency: 112ms
Audio Format: WAV (embedded)

Vocal engine model matches. Ready for integration into chatbot pipelines.`;
      }
    },
    'fraud-detector': {
      title: 'AI Fraud Detector',
      desc: 'Analyze transaction logs to predict fraud anomalies and score risk scores.',
      icon: 'fa-shield-halved',
      inputs: [
        { id: 'amount', label: 'Transaction Value ($)', type: 'text', placeholder: 'e.g. 1499.00', default: '1499.00' },
        { id: 'ip', label: 'Source IP Address', type: 'text', placeholder: 'e.g. 192.168.1.1', default: '198.51.100.42' },
        { id: 'loc', label: 'Billing Country Location', type: 'select', options: ['US', 'UA', 'CN', 'NG', 'UK'], default: 'US' },
        { id: 'time', label: 'Submission Local Time', type: 'select', options: ['Midnight (3 AM)', 'Midday (2 PM)'], default: 'Midnight (3 AM)' }
      ],
      action: 'Scan Transaction Metrics',
      run: (vals) => {
        const amt = vals.amount || '1499.00';
        const ip = vals.ip || '198.51.100.42';
        const loc = vals.loc || 'US';
        const time = vals.time || 'Midnight (3 AM)';
        const rating = loc === 'US' && time === 'Midday (2 PM)' ? 'LOW RISK (15/100)' : 'HIGH RISK (82/100)';
        return `[NexusHub Fraud Guard] running heuristic models...
Amount: $${amt}
IP Range: ${ip}
Location: ${loc}
Time: ${time}

--- RISK RATING: ${rating} ---

--- FRAUD ALERTS FOUND ---
${rating.includes('HIGH') ? `[ALERT] High-value transaction at abnormal hour (3 AM Local User Time)
[ALERT] Country code mismatched with registration location.
[ALERT] IP address flagged under residential proxy networks.

Action Recommended: Hold payment capture & trigger SMS 2-Factor Authentication.` : `[INFO] Transaction profiles conform to normal activity limits.
No suspicious signatures found.`}`;
      }
    },
    'lead-scraper': {
      title: 'AI Lead Scraper',
      desc: 'Parse and scrape structured emails, profiles, and contact fields from text copy.',
      icon: 'fa-filter',
      inputs: [
        { id: 'text', label: 'Unstructured Text Body', type: 'textarea', placeholder: 'Paste text copy...', default: 'Contact our sales directors at sales@nexushub.ai or partner-relations@nexushub.ai. Phone lines are open at +1-800-555-0199 or drop by office 204. For billing questions contact billing@nexushub.ai or call +44-20-7946-0958.' }
      ],
      action: 'Parse & Scrape Contact Fields',
      run: (vals) => {
        return `[NexusHub Lead Extractor] Scanning unstructured text...
Scanning regex filters for email & standard E.164 phone numbers...

--- EMAILS FOUND (3) ---
1. sales@nexushub.ai (Department: Sales)
2. partner-relations@nexushub.ai (Department: Partner Relations)
3. billing@nexushub.ai (Department: Billing)

--- PHONE NUMBERS FOUND (2) ---
1. +1-800-555-0199 (Toll Free US)
2. +44-20-7946-0958 (London, UK)

Parsed: 5 records successfully structured.`;
      }
    },
    'expense-classifier': {
      title: 'AI Expense Classifier',
      desc: 'Audit receipt values and map items automatically to standard tax categories.',
      icon: 'fa-receipt',
      inputs: [
        { id: 'expense', label: 'Expense Items Copy', type: 'textarea', placeholder: 'e.g. taxi bill $50...', default: 'Taxi ride from JFK airport to office $65.00, client lunch at Italian Bistro $120.00, AWS Cloud monthly Hosting bill $450.00' }
      ],
      action: 'Classify Ledger Expenses',
      run: (vals) => {
        return `[NexusHub Bookkeeping AI] Parsing ledger entries...
Mapping expenses to tax codes...

--- TAX CATEGORY CLASSIFICATION ---
1. JFK Airport Taxi ($65.00)
   -> Category: Travel & Lodging (Tax Code: 104-B)

2. Client Lunch Bistro ($120.00)
   -> Category: Meals & Entertainment (Tax Code: 203-A - 50% Deductible)

3. AWS Hosting Bill ($450.00)
   -> Category: Tech Infrastructure & Software (Tax Code: 809-C)

Total Audited Value: $635.00`;
      }
    },
    'product-copy': {
      title: 'AI Product Copywriter',
      desc: 'Draft marketing copy and headlines for catalog products.',
      icon: 'fa-pen-nib',
      inputs: [
        { id: 'name', label: 'Product Brand Name', type: 'text', placeholder: 'e.g. Wireless Charging Dock', default: 'NexusHub Wireless Charging Dock' },
        { id: 'features', label: 'Core Product Features', type: 'text', placeholder: 'e.g. 15W fast charge...', default: '15W fast charge, built-in LED ambient clock, eco-friendly bamboo wood finish' },
        { id: 'audience', label: 'Target Demographic', type: 'select', options: ['Gen Z Trendsetters', 'Corporate Professionals', 'Minimalist Techies'], default: 'Minimalist Techies' }
      ],
      action: 'Generate Ad Copy',
      run: (vals) => {
        const name = vals.name || 'Wireless Charging Dock';
        const aud = vals.audience || 'Minimalist Techies';
        return `[NexusHub Product Copywriter] Crafting sales angles...
Product: ${name}
Audience: ${aud}

--- HERO HEADLINE ---
"Declutter your workspace. Power your focus."

--- BULLET COPY ---
- Eco-Friendly Craftsmanship: Made of sustainable bamboo wood to blend perfectly with clean desk aesthetics.
- 15W High-Efficiency Charging: Power up your device in half the time without messy cable tangles.
- Intelligent Ambient Clock: Subtle LED display ensures you track time without notification distractions.

--- CALL TO ACTION ---
"Upgrade your desk setup now. Buy ${name} today."`;
      }
    },
    'tone-tuner': {
      title: 'AI Brand Tone Tuner',
      desc: 'Tune brand copy voice between sarcastic, professional, or casual tones.',
      icon: 'fa-sliders',
      inputs: [
        { id: 'tone', label: 'Desired Brand Voice', type: 'select', options: ['Corporate jargon', 'Highly Sarcastic', 'Friendly & Casual'], default: 'Highly Sarcastic' },
        { id: 'text', label: 'Original Source Text', type: 'textarea', placeholder: 'Enter sentence...', default: 'We need to finish this report by Friday afternoon or we will get in trouble with the client.' }
      ],
      action: 'Tune Voice Tone',
      run: (vals) => {
        const tone = vals.tone || 'Highly Sarcastic';
        let rewritten = '';
        if (tone === 'Highly Sarcastic') {
          rewritten = `"Let's absolutely run a sprint to complete this glorious report by Friday. After all, what is a weekend if not a window to contemplate our life choices under the crushing weight of client passive-aggressive emails? Let's make our bosses proud, team!"`;
        } else if (tone === 'Corporate jargon') {
          rewritten = `"We must align deliverables to facilitate optimal bandwidth sync and ensure execution of key milestones by EOB Friday. Failure to comply poses critical alignment risks regarding our external relationship dynamics."`;
        } else {
          rewritten = `"Hey team! Let's pull together to knock this report out by Friday afternoon so we can keep our client super happy and head into the weekend stress-free!"`;
        }
        return `[NexusHub Tone Tuner] Tuning voice frequency...
Selected Tone: ${tone}

--- REWRITTEN VERSION ---
${rewritten}`;
      }
    },
    'invoice-automator': {
      title: 'AI Invoice Automator',
      desc: 'Input client deliverables to calculate service totals and render billing charts.',
      icon: 'fa-file-invoice-dollar',
      inputs: [
        { id: 'client', label: 'Client Organization Name', type: 'text', placeholder: 'Acme Corp', default: 'Acme Corp' },
        { id: 'rate', label: 'Billing Hourly Rate ($)', type: 'text', placeholder: '150', default: '150' },
        { id: 'hours', label: 'Billable Hours Logged', type: 'text', placeholder: '45', default: '45' },
        { id: 'tax', label: 'Applicable Sales Tax', type: 'select', options: ['0%', '5%', '10%', '20%'], default: '10%' }
      ],
      action: 'Calculate Billing Metrics',
      run: (vals) => {
        const client = vals.client || 'Acme Corp';
        const rate = parseFloat(vals.rate) || 150;
        const hours = parseFloat(vals.hours) || 45;
        const taxPercent = parseFloat(vals.tax) || 10;
        const subtotal = rate * hours;
        const taxVal = subtotal * (taxPercent / 100);
        const total = subtotal + taxVal;
        return `[NexusHub Invoice Compiler] Calculating billing matrix...
Client: ${client}
Hourly Rate: $${rate}/hr
Hours: ${hours}
Tax Rate: ${taxPercent}%

--- INVOICE SUMMARY ---
Subtotal: $${subtotal.toFixed(2)}
Tax Value: $${taxVal.toFixed(2)}
-------------------------
TOTAL AMOUNT DUE: $${total.toFixed(2)}

Invoice Reference: INV-2026-${Math.floor(Math.random() * 9000 + 1000)}
Payment Terms: Net 30
Status: Ready for Delivery`;
      }
    },
    'cold-email': {
      title: 'AI Cold Outreach Composer',
      desc: 'Generate high-converting cold pitch sequences with personalized value offers.',
      icon: 'fa-envelope-open-text',
      inputs: [
        { id: 'industry', label: 'Prospect Business Niche', type: 'select', options: ['Venture Capital', 'SAAS Founders', 'Marketing Agencies'], default: 'SAAS Founders' },
        { id: 'offer', label: 'Core Value Offer Proposal', type: 'text', placeholder: 'e.g. cut AWS cost...', default: 'cut AWS server costs by 40% using automated cloud scheduler' },
        { id: 'name', label: 'Prospect Contact Name', type: 'text', placeholder: 'Sarah Jenkins', default: 'Sarah Jenkins' }
      ],
      action: 'Compose Outreach Sequence',
      run: (vals) => {
        const ind = vals.industry || 'SAAS Founders';
        const off = vals.offer || 'cut AWS costs';
        const name = vals.name || 'Sarah Jenkins';
        return `[NexusHub Outreach AI] Building high-convert templates...
Prospect Name: ${name}
Target Industry: ${ind}

--- OUTBOUND EMAIL ---
Subject: ${name}, Quick Question on ${ind} Infrastructure Costs?

Hi ${name},

I noticed your team has been scaling rapidly. Congratulations!

Many SaaS companies face skyrocketing hosting bills as they scale. We built a scheduler tool that helps teams ${off} with zero downtime.

Do you have 5 minutes this Thursday for a brief chat to see if this fits your stack?

Best,
NexusHub Team`;
      }
    },
    'jd-gen': {
      title: 'AI Job Description Builder',
      desc: 'Draft structured, ATS-compliant job vacancy posts targeted to specific role skills.',
      icon: 'fa-briefcase',
      inputs: [
        { id: 'title', label: 'Job Role Title', type: 'text', placeholder: 'e.g. Senior Full Stack AI Developer', default: 'Senior Full Stack AI Developer' },
        { id: 'exp', label: 'Experience Level Required', type: 'select', options: ['Junior (1-3 yrs)', 'Mid (3-5 yrs)', 'Senior (5-8 yrs)', 'Lead (8+ yrs)'], default: 'Senior (5-8 yrs)' },
        { id: 'skills', label: 'Key Technological Skills', type: 'text', placeholder: 'React, Python...', default: 'React, Node.js, Python, Firebase, OpenAI API' }
      ],
      action: 'Build Job Posting',
      run: (vals) => {
        const title = vals.title || 'Senior Full Stack AI Developer';
        const exp = vals.exp || 'Senior (5-8 yrs)';
        const skills = vals.skills || '';
        return `[NexusHub Recruit AI] Drafting Job Posting...
Role: ${title}
Experience Level: ${exp}
Key Skills: ${skills}

--- JOB SUMMARY ---
We are seeking a ${title} to lead the engineering of our multi-agent portal workspace. You will orchestrate client systems, AI pipelines, and build interactive dashboards.

--- CORE RESPONSIBILITIES ---
- Build interactive dashboards and UI workflows.
- Connect LLM APIs and client-side DB architectures.
- Optimize system performance and OAuth authentication.

--- REQUIRED QUALIFICATIONS ---
- Experience matching ${exp} requirements.
- Core proficiency in: ${skills}.
- Strong alignment with security and performance best practices.`;
      }
    },
    'ppt-designer': {
      title: 'AI Presentation Designer',
      desc: 'Convert a topic outline into a clean 3-slide mock presentation outline deck copy.',
      icon: 'fa-chalkboard-user',
      inputs: [
        { id: 'topic', label: 'Presentation Core Subject', type: 'text', placeholder: 'Rise of AI...', default: 'The Rise of Decentralized AI Agents' },
        { id: 'style', label: 'Visual Theme Layout', type: 'select', options: ['Minimalist Corporate', 'Bold Startup Pitch', 'Scientific Lecture'], default: 'Bold Startup Pitch' }
      ],
      action: 'Generate Slides Outline',
      run: (vals) => {
        const topic = vals.topic || '';
        const style = vals.style || 'Bold Startup Pitch';
        return `[NexusHub Slide Designer] Formatting presentation deck...
Topic: ${topic}
Theme Style: ${style}

--- SLIDE 1: TITLE SLIDE ---
[Title] Autonomous, Aligned, and Everywhere.
[Subtitle] How Decentralized AI agents are bypassing cloud servers to run locally.
[Aesthetic Note] Dark backdrop, HSL violet neon font accent.

--- SLIDE 2: THE PROBLEM ---
[Header] The Centralization Trap
[Content] High API costs, privacy concerns, and offline latency.

--- SLIDE 3: THE SOLUTION ---
[Header] NexusHub Agent Edge
[Content] Micro-models executing in-browser. Fully private, zero-latency.`;
      }
    },
    'churn-predictor': {
      title: 'AI Churn Predictor',
      desc: 'Calculate customer cancellation likelihood matrices based on service logs.',
      icon: 'fa-user-minus',
      inputs: [
        { id: 'spend', label: 'Monthly User Spend ($)', type: 'text', placeholder: '99.00', default: '99.00' },
        { id: 'months', label: 'Account Lifespan (Months)', type: 'text', placeholder: '14', default: '14' },
        { id: 'tickets', label: 'Recent Support Tickets Raised', type: 'select', options: ['0-1 (Low)', '2-4 (Medium)', '5+ (High)'], default: '5+ (High)' },
        { id: 'inactive', label: 'Days Since Last Session Log', type: 'text', placeholder: '12', default: '12' }
      ],
      action: 'Evaluate Churn Risk',
      run: (vals) => {
        const spend = vals.spend || '99.00';
        const months = vals.months || '14';
        const tickets = vals.tickets || '5+ (High)';
        const inactive = vals.inactive || '12';
        return `[NexusHub Churn Guard] Assessing customer health metrics...
Customer Profile: Monthly Spend $${spend}, Active ${months} Months
Support Ticket Volume: ${tickets}
Inactive Period: ${inactive} Days

--- CHURN PROBABILITY: 74% (HIGH RISK) ---

--- MAIN CONTRIBUTOR FACTORS ---
- User hasn't logged in for ${inactive} days (Average threshold is 4 days).
- ${tickets} support tickets raised in the last 30 days indicates unresolved system frustration.

Action Plan: Trigger automated "Customer Success Check-in" email with a 20% discount coupon.`;
      }
    },
    'price-auditor': {
      title: 'AI Price Auditor',
      desc: 'Audit product prices against competitors to optimize pricing suggestions.',
      icon: 'fa-magnifying-glass-dollar',
      inputs: [
        { id: 'cat', label: 'Product Catalog Segment', type: 'select', options: ['SaaS Starter Plan', 'API Tokens / Million', 'E-Commerce Hoodie'], default: 'SaaS Starter Plan' },
        { id: 'your_price', label: 'Your Listed Retail Price ($)', type: 'text', placeholder: '29.00', default: '29.00' },
        { id: 'comp_a', label: 'Competitor A Base Price ($)', type: 'text', placeholder: '35.00', default: '35.00' },
        { id: 'comp_b', label: 'Competitor B Base Price ($)', type: 'text', placeholder: '19.00', default: '19.00' }
      ],
      action: 'Audit Pricing Position',
      run: (vals) => {
        const cat = vals.cat || 'SaaS Starter Plan';
        const mine = parseFloat(vals.your_price) || 29;
        const compA = parseFloat(vals.comp_a) || 35;
        const compB = parseFloat(vals.comp_b) || 19;
        return `[NexusHub Commerce AI] Running price comparison...
Category: ${cat}
Your Price: $${mine.toFixed(2)} | Competitors: $${compA.toFixed(2)} (A), $${compB.toFixed(2)} (B)

--- COMPETITIVE AUDIT ---
- You are priced ${Math.round(((compA - mine) / compA) * 100)}% LOWER than Competitor A (Premium brand position).
- You are priced ${Math.round(((mine - compB) / compB) * 100)}% HIGHER than Competitor B (Low-cost disruptor).

--- STRATEGIC SUGGESTION ---
Status: Sweet Spot. Maintain $${mine.toFixed(2)} but emphasize features (e.g. 20+ plugins) that Competitor B lacks, avoiding a price race to the bottom.`;
      }
    },
    'web-scraper': {
      title: 'AI Web Scraper',
      desc: 'Extract content layers and meta descriptors from simulated URL target pages.',
      icon: 'fa-spider',
      inputs: [
        { id: 'url', label: 'Target URL Web Address', type: 'text', placeholder: 'https://...', default: 'https://news.ycombinator.com/news' },
        { id: 'selector', label: 'HTML CSS Selector query', type: 'text', placeholder: '.titleline', default: '.titleline' }
      ],
      action: 'Crawl Domain Elements',
      run: (vals) => {
        const url = vals.url || '';
        const sel = vals.selector || '';
        return `[NexusHub Web Crawler] Resolving hostname ${url.split('/')[2] || 'news.ycombinator.com'}...
Downloading HTML structure (mock request)...
Query Selector Target: ${sel}

--- SCRAPED TITLES FOUND ---
1. NexusHub AI launches local in-browser micro-services (nexushub.ai) [Score: 488]
2. Show HN: A client-side 3D agent dashboard with SQLite (github.com/nexushub) [Score: 212]
3. Why WebAssembly is the future of edge computing models (medium.com) [Score: 180]

Crawler Status: Completed. 3 items cached.`;
      }
    },
    'tag-extractor': {
      title: 'AI SEO Tag Extractor',
      desc: 'Scan web address headers to list meta keywords, og:image details, and anchors.',
      icon: 'fa-tags',
      inputs: [
        { id: 'url', label: 'Source Web Address URL', type: 'text', placeholder: 'https://...', default: 'https://nexushub.ai' }
      ],
      action: 'Extract SEO Meta tags',
      run: (vals) => {
        const url = vals.url || 'https://nexushub.ai';
        return `[NexusHub Tag Extractor] Fetching response headers for ${url}...

--- EXTRACTED META HEADER DATA ---
- og:title: "NexusHub AI - Immersive 3D Business Deck"
- og:description: "Run autonomous agents, voice cloner, and billing automation."
- og:image: "${url}/assets/preview.png"
- og:type: "website"
- robots: "index, follow"
- canonical: "${url}"

Extraction Success: Meta tags are fully structured for indexing.`;
      }
    },
    'text-summarizer': {
      title: 'AI Text Summarizer',
      desc: 'Condense long pages and documentation inputs into single structured bullet outlines.',
      icon: 'fa-compress',
      inputs: [
        { id: 'level', label: 'Detail Summary Mode', type: 'select', options: ['High Level (1-2 sentences)', 'Medium (3-5 bullets)', 'Deep Dive Summary'], default: 'Medium (3-5 bullets)' },
        { id: 'text', label: 'Raw Multi-line Input Text', type: 'textarea', placeholder: 'Paste content here...', default: 'Artificial intelligence agents are autonomous entities capable of interpreting environmental parameters, formulating task lists, and invoking external tools to satisfy user-defined target goals. By running these execution loops inside modern client-side browsers using lightweight models, developers can bypass high centralized cloud API costs and offer local, secure alternatives that respect user privacy bounds. NexusHub provides 22 such tools for instant operational deployment.' }
      ],
      action: 'Condense Content Copy',
      run: (vals) => {
        const level = vals.level || 'Medium (3-5 bullets)';
        let output = '';
        if (level.includes('High Level')) {
          output = `Artificial intelligence agents execute local edge loops in browsers to bypass centralized cloud costs and enhance user privacy bounds.`;
        } else if (level.includes('Medium')) {
          output = `- AI agents operate autonomously by reading parameters and executing loops.
- Edge execution (running in-browser) eliminates cloud costs and enhances data privacy.
- NexusHub packages 22 lightweight tools designed for client-side task optimization.`;
        } else {
          output = `--- DEEP SUMMARY DECK ---
Autonomous AI agents analyze environmental parameters, compile structural tasks, and call tools. Running these functions inside client-side browsers allows software products to bypass cloud API charges, providing low-latency, private offline alternatives. The NexusHub platform aggregates 22 specialized, in-browser plugins executing tasks from SEO management to receipt sorting instantly.`;
        }
        return `[NexusHub Summary Engine] Running semantic reduction...
Mode: ${level}

--- SUMMARY OUTPUT ---
${output}`;
      }
    },
    'grammar-fixer': {
      title: 'AI Grammar Fixer',
      desc: 'Scan draft copy to automatically proofread, fix spelling errors, and polish clarity.',
      icon: 'fa-spell-check',
      inputs: [
        { id: 'variant', label: 'English Locale Variant', type: 'select', options: ['US English', 'UK English'], default: 'US English' },
        { id: 'text', label: 'Draft Text Copy to Fix', type: 'textarea', placeholder: 'Enter text here...', default: 'Their is no doubt that our team have did a amazing job, we was able to fix the auth issue and rename it to NexusHub.' }
      ],
      action: 'Audit Grammar & Spelling',
      run: (vals) => {
        const variant = vals.variant || 'US English';
        return `[NexusHub Grammar Fixer] scanning syntactic tokens...
Target Variant: ${variant}

--- DETECTED ERRORS ---
- "Their" -> "There" (Homophone error)
- "team have did" -> "team has done" (Subject-verb agreement & tense)
- "a amazing" -> "an amazing" (Article error)
- "we was" -> "we were" (Subject-verb agreement)

--- POLISHED DRAFT ---
"There is no doubt that our team has done an amazing job; we were able to fix the authentication issue and rename the workspace to NexusHub."`;
      }
    }
  };

  // Launch button listeners
  const appStorePanel = document.getElementById('panel-app-store');
  if (appStorePanel) {
    appStorePanel.addEventListener('click', (e) => {
      const launchBtn = e.target.closest('.btn-launch-plugin');
      if (!launchBtn) return;

      const pluginId = launchBtn.dataset.plugin;
      const data = pluginsData[pluginId];
      if (!data) return;

      // Populate metadata
      if (pluginIcon) pluginIcon.innerHTML = `<i class="fa-solid ${data.icon}"></i>`;
      if (pluginTitle) pluginTitle.innerText = data.title;
      if (pluginDesc) pluginDesc.innerText = data.desc;

      // Populate input elements
      if (pluginInputs) {
        pluginInputs.innerHTML = '';
        data.inputs.forEach(inp => {
          const group = document.createElement('div');
          group.className = 'plugin-input-group';

          const label = document.createElement('label');
          label.innerText = inp.label;
          label.setAttribute('for', `plugin-inp-${inp.id}`);
          group.appendChild(label);

          if (inp.type === 'select') {
            const select = document.createElement('select');
            select.id = `plugin-inp-${inp.id}`;
            inp.options.forEach(opt => {
              const option = document.createElement('option');
              option.value = opt;
              option.innerText = opt;
              if (opt === inp.default) option.selected = true;
              select.appendChild(option);
            });
            group.appendChild(select);
          } else if (inp.type === 'textarea') {
            const textarea = document.createElement('textarea');
            textarea.id = `plugin-inp-${inp.id}`;
            textarea.rows = 4;
            textarea.value = inp.default;
            group.appendChild(textarea);
          } else {
            const input = document.createElement('input');
            input.type = 'text';
            input.id = `plugin-inp-${inp.id}`;
            input.value = inp.default;
            group.appendChild(input);
          }
          pluginInputs.appendChild(group);
        });
      }

      // Populate actions
      if (pluginActions) {
        pluginActions.innerHTML = '';
        const runBtn = document.createElement('button');
        runBtn.type = 'button';
        runBtn.className = 'btn-primary';
        runBtn.style.width = '100%';
        runBtn.style.justifyContent = 'center';
        runBtn.innerHTML = `<i class="fa-solid ${data.icon}"></i> ${data.action}`;
        runBtn.addEventListener('click', () => {
          const vals = {};
          data.inputs.forEach(inp => {
            const element = document.getElementById(`plugin-inp-${inp.id}`);
            if (element) {
              vals[inp.id] = element.value;
            }
          });

          // Visual loader
          if (pluginOutputContainer) pluginOutputContainer.style.display = 'flex';
          if (pluginOutput) {
            pluginOutput.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing calculations...';
          }

          setTimeout(() => {
            const outputText = data.run(vals);
            if (pluginOutput) {
              pluginOutput.textContent = outputText;
            }
            logActivity('App Store', `Successfully executed ${data.title}`);
          }, 600);
        });
        pluginActions.appendChild(runBtn);
      }

      // Clear output
      if (pluginOutputContainer) pluginOutputContainer.style.display = 'none';
      if (pluginOutput) pluginOutput.textContent = '';

      // Display Modal
      if (pluginModal) pluginModal.classList.add('open');
      logActivity('App Store', `Configured plugin workspace: ${data.title}`);
    });
  }

  // -------------------------------------------------------------
  // 3D Canvas Rotating Cyber-Globe & Sine Wave Grid
  // -------------------------------------------------------------
  window.init3DCyberGlobe = function(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = canvas.width;
    let height = canvas.height;
    
    function resize() {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const numPoints = 75;
    const points = [];
    const radius = Math.min(width, height) * 0.35;
    
    for (let i = 0; i < numPoints; i++) {
      const y = 1 - (i / (numPoints - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const goldenRatio = (1 + Math.sqrt(5)) / 2;
      const theta = 2 * Math.PI * i / goldenRatio;
      points.push({
        x: Math.cos(theta) * radiusAtY * radius,
        y: y * radius,
        z: Math.sin(theta) * radiusAtY * radius
      });
    }

    let angleX = 0.003;
    let angleY = 0.005;
    let mouseX = 0;
    let mouseY = 0;

    window.addEventListener('mousemove', (e) => {
      mouseX = (e.clientX - window.innerWidth / 2) * 0.00005;
      mouseY = (e.clientY - window.innerHeight / 2) * 0.00005;
    });

    function animate() {
      if (!document.getElementById(canvasId)) return;
      ctx.clearRect(0, 0, width, height);

      const ax = angleX + mouseY;
      const ay = angleY + mouseX;
      const cosX = Math.cos(ax);
      const sinX = Math.sin(ax);
      const cosY = Math.cos(ay);
      const sinY = Math.sin(ay);

      points.forEach(p => {
        let x1 = p.x * cosY - p.z * sinY;
        let z1 = p.z * cosY + p.x * sinY;
        let y2 = p.y * cosX - z1 * sinX;
        let z2 = z1 * cosX + p.y * sinX;
        p.x = x1;
        p.y = y2;
        p.z = z2;
      });

      const cx = width / 2;
      const cy = height / 2;
      const fov = 350;

      const projected = points.map(p => {
        const scale = fov / (fov + p.z);
        return {
          x: cx + p.x * scale,
          y: cy + p.y * scale,
          scale: scale,
          depth: p.z
        };
      });

      ctx.lineWidth = 0.5;
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const dx = points[i].x - points[j].x;
          const dy = points[i].y - points[j].y;
          const dz = points[i].z - points[j].z;
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
          if (dist < radius * 0.7) {
            const avgDepth = (projected[i].depth + projected[j].depth) / 2;
            const alpha = Math.max(0.01, (1 - dist / (radius * 0.7)) * (1 - (avgDepth + radius) / (2 * radius)) * 0.25);
            ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(projected[i].x, projected[i].y);
            ctx.lineTo(projected[j].x, projected[j].y);
            ctx.stroke();
          }
        }
      }

      projected.forEach((p, idx) => {
        const size = (p.depth + radius) / (2 * radius) * 2.5 + 0.8;
        const alpha = Math.max(0.08, (p.depth + radius) / (2 * radius) * 0.6);
        ctx.fillStyle = `rgba(6, 182, 212, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
        if (idx % 10 === 0) {
          ctx.strokeStyle = `rgba(139, 92, 246, ${alpha * 0.35})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, size * (1.6 + Math.sin(Date.now() * 0.004 + idx) * 0.4), 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      requestAnimationFrame(animate);
    }
    animate();
  };

  window.initSineWaveGrid = function(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = canvas.width;
    let height = canvas.height;
    
    function resize() {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    }
    resize();
    window.addEventListener('resize', resize);
    
    let time = 0;
    let mouse = { x: 0, y: 0 };
    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    function animate() {
      if (!document.getElementById(canvasId)) return;
      ctx.clearRect(0, 0, width, height);
      time += 0.008;
      const numLines = 4;
      const spacing = height / (numLines + 1);
      
      for (let i = 0; i < numLines; i++) {
        ctx.beginPath();
        const lineY = (i + 1) * spacing;
        for (let x = 0; x < width; x += 20) {
          const distToMouse = Math.abs(x - mouse.x);
          const mouseInfluence = distToMouse < 200 ? (1 - distToMouse / 200) * 35 : 0;
          const y = lineY + Math.sin(x * 0.004 + time + i) * 15 + Math.cos(x * 0.008 - time * 0.4) * 8 + (mouseInfluence * Math.sin(time * 4));
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        const grad = ctx.createLinearGradient(0, 0, width, 0);
        grad.addColorStop(0, 'rgba(6, 182, 212, 0.01)');
        grad.addColorStop(0.5, 'rgba(139, 92, 246, 0.12)');
        grad.addColorStop(1, 'rgba(6, 182, 212, 0.01)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      requestAnimationFrame(animate);
    }
    animate();
  };

  window.init3DCardTilt = function() {
    const cards = document.querySelectorAll('.dashboard-card, .suite-card-large, .agent-card-large, .adv-feature-card, .integration-card-large');
    cards.forEach(card => {
      card.style.transition = 'transform 0.15s ease-out, box-shadow 0.15s ease-out';
      card.style.transformStyle = 'preserve-3d';
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const xc = rect.width / 2;
        const yc = rect.height / 2;
        const rotateX = -(y - yc) / 12;
        const rotateY = (x - xc) / 12;
        card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        card.style.boxShadow = `0 10px 25px rgba(0,0,0,0.3), ${-rotateY * 1.2}px ${rotateX * 1.2}px 18px rgba(139, 92, 246, 0.18)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg)';
        card.style.boxShadow = 'none';
      });
    });
  };

  // -------------------------------------------------------------
  // 17. 41 Premium Extra Dashboard Features & Interactive UI
  // -------------------------------------------------------------
  function initPremiumAdditions() {
    // A. All-in-One AI Suite additions
    const suiteAdditions = document.getElementById('premium-suite-additions');
    if (suiteAdditions) {
      suiteAdditions.innerHTML = `
        <div class="premium-feature-title-area">
          <h3>Premium Suite Extension Services</h3>
          <p>Instantly deploy advanced generation sandbox capabilities</p>
        </div>
        <div class="premium-grid-2">
          <!-- Tool 1 & 2: Image & Storyboard -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-wand-magic-sparkles" style="color:var(--color-primary);"></i> AI Image Generator & Storyboarder</h4>
            <div class="premium-form-group">
              <label>Text Description Prompt</label>
              <input type="text" id="suite-img-prompt" class="premium-input" placeholder="e.g. Glowing cybernetic neuron grid rendering neon pathways...">
            </div>
            <div class="premium-form-group">
              <label>Storyboard Scene Frames (Transition Seconds)</label>
              <input type="range" id="suite-storyboard-frames" min="1" max="10" value="4" style="accent-color:var(--color-primary);">
              <span id="suite-frame-lbl" style="font-size:0.65rem; color:var(--text-secondary);">Render timing: 4 frames sequence preview</span>
            </div>
            <div class="premium-form-row">
              <button type="button" class="btn-primary" id="btn-suite-img-gen" style="font-size:0.72rem; padding:8px 14px;">Generate Image Sandbox</button>
              <button type="button" class="btn-secondary" id="btn-suite-story-gen" style="font-size:0.72rem; padding:8px 14px;">Compile Storyboard</button>
            </div>
            <div id="suite-sandbox-visual-output" style="display:none; text-align:center; padding:12px; background:rgba(0,0,0,0.3); border:1px solid var(--border-color); border-radius:10px; min-height:100px;"></div>
          </div>
          <!-- Tool 3, 4 & 5: Logo, TTS & Code Transpiler -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-code" style="color:var(--color-secondary);"></i> Dynamic Logo Modulator & Transpiler</h4>
            <div class="premium-form-row">
              <div class="premium-form-group">
                <label>Company Initials</label>
                <input type="text" id="suite-logo-initials" class="premium-input" value="NH">
              </div>
              <div class="premium-form-group">
                <label>Theme Niche</label>
                <select id="suite-logo-theme" class="premium-select">
                  <option value="cyber">Cyber Purple</option>
                  <option value="neon">Neon Cyan</option>
                  <option value="gold">Gold Premium</option>
                </select>
              </div>
            </div>
            <div class="premium-form-group">
              <label>Speech Output Reader Text</label>
              <div class="premium-form-row">
                <input type="text" id="suite-tts-text" class="premium-input" value="Welcome to NexusHub AI platform. Launching training matrices...">
                <button type="button" class="btn-primary" id="btn-suite-tts-run" style="padding:8px 12px;"><i class="fa-solid fa-volume-high"></i> Speak</button>
              </div>
            </div>
            <div class="premium-form-group">
              <label>Code Transpiler (Convert Javascript to Target)</label>
              <textarea id="suite-code-input" class="premium-textarea" rows="2" style="font-family:monospace; font-size:0.65rem;">const handleData = (arr) => arr.map(x => x * 2);</textarea>
              <div class="premium-form-row" style="margin-top:6px;">
                <select id="suite-transpiler-lang" class="premium-select" style="font-size:0.68rem; padding:4px;">
                  <option value="py">Python</option>
                  <option value="rust">Rust</option>
                  <option value="cpp">C++</option>
                </select>
                <button type="button" class="btn-primary" id="btn-suite-transpile" style="font-size:0.7rem; padding:6px 12px;">Transpile</button>
              </div>
            </div>
            <div id="suite-transpile-output" style="display:none; font-family:monospace; font-size:0.65rem; color:#10b981; padding:8px; background:rgba(0,0,0,0.4); border-radius:6px; border:1px solid var(--border-color); white-space:pre-wrap;"></div>
          </div>
        </div>
      `;

      // Storyboard slider label binding
      const framesInput = document.getElementById('suite-storyboard-frames');
      if (framesInput) {
        framesInput.addEventListener('input', (e) => {
          document.getElementById('suite-frame-lbl').innerText = `Render timing: ${e.target.value} frames sequence preview`;
        });
      }

      // Generate Image button
      document.getElementById('btn-suite-img-gen').addEventListener('click', () => {
        const prompt = document.getElementById('suite-img-prompt').value || 'AI Interface';
        const output = document.getElementById('suite-sandbox-visual-output');
        output.style.display = 'block';
        output.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Rendering Vector Image Canvas...';
        setTimeout(() => {
          output.innerHTML = `
            <svg width="100%" height="80" viewBox="0 0 300 80" style="background:#090d16; border-radius:8px;">
              <defs>
                <linearGradient id="suite-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="var(--color-primary)" />
                  <stop offset="100%" stop-color="var(--color-secondary)" />
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="300" height="80" fill="#090d16" />
              <circle cx="150" cy="40" r="25" fill="url(#suite-grad)" opacity="0.3" />
              <line x1="20" y1="40" x2="280" y2="40" stroke="url(#suite-grad)" stroke-width="1" stroke-dasharray="4" />
              <text x="150" y="44" fill="#fff" font-size="8" font-family="monospace" text-anchor="middle">${prompt.substring(0, 30)}...</text>
            </svg>
            <div style="font-size:0.62rem; color:var(--color-success); margin-top:4px;">[SUCCESS] SVG Image generated matching parameter weights!</div>
          `;
          logActivity('Suite Catalog', `Generated sandbox image: ${prompt}`);
        }, 1000);
      });

      // Storyboard button
      document.getElementById('btn-suite-story-gen').addEventListener('click', () => {
        const val = document.getElementById('suite-storyboard-frames').value;
        const output = document.getElementById('suite-sandbox-visual-output');
        output.style.display = 'block';
        output.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Compiling storyboard timeline for ${val} frames...`;
        setTimeout(() => {
          let timelineHtml = '<div style="display:flex; gap:6px; justify-content:center; margin-top:6px;">';
          for (let i = 1; i <= val; i++) {
            timelineHtml += `
              <div style="flex:1; border:1px solid rgba(255,255,255,0.1); padding:4px; border-radius:4px; font-size:0.55rem; background:rgba(255,255,255,0.02);">
                <div style="color:var(--color-secondary); font-weight:700;">Frame #${i}</div>
                <div style="color:var(--text-secondary); margin-top:2px;">Scene keypoint: ${i*10}s</div>
              </div>
            `;
          }
          timelineHtml += '</div>';
          output.innerHTML = `
            <div style="font-size:0.7rem; font-weight:700; color:#fff; text-align:left;">Compiled Video Storyboard timeline:</div>
            ${timelineHtml}
            <div style="font-size:0.6rem; color:var(--text-secondary); margin-top:6px;">Resolution output: 1080p keyframes generated. Ready to export.</div>
          `;
          logActivity('Suite Catalog', `Compiled storyboard timeline of ${val} scenes.`);
        }, 1200);
      });

      // TTS Speech button
      document.getElementById('btn-suite-tts-run').addEventListener('click', () => {
        const txt = document.getElementById('suite-tts-text').value;
        if (!txt) return;
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(txt);
          utterance.pitch = 1.1;
          utterance.rate = 1.0;
          window.speechSynthesis.speak(utterance);
          alert(`Reading voice synthesis: "${txt}"`);
          logActivity('Suite Catalog', `Synthesized speech: "${txt}"`);
        } else {
          alert("Speech Synthesis not supported in this browser environment.");
        }
      });

      // Transpile button
      document.getElementById('btn-suite-transpile').addEventListener('click', () => {
        const code = document.getElementById('suite-code-input').value;
        const lang = document.getElementById('suite-transpiler-lang').value;
        const output = document.getElementById('suite-transpile-output');
        output.style.display = 'block';
        output.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analysing AST nodes...';
        setTimeout(() => {
          let res = '';
          if (lang === 'py') {
            res = `def handle_data(arr):\n    return [x * 2 for x in arr]`;
          } else if (lang === 'rust') {
            res = `fn handle_data(arr: Vec<i32>) -> Vec<i32> {\n    arr.iter().map(|x| x * 2).collect()\n}`;
          } else {
            res = `#include <vector>\nstd::vector<int> handleData(std::vector<int>& arr) {\n    std::vector<int> out;\n    for(int x : arr) out.push_back(x * 2);\n    return out;\n}`;
          }
          output.textContent = res;
          logActivity('Suite Catalog', `Transpiled JS code block to ${lang.toUpperCase()}`);
        }, 900);
      });
    }

    // B. Agent Marketplace additions
    const agentAdditions = document.getElementById('premium-agent-additions');
    if (agentAdditions) {
      agentAdditions.innerHTML = `
        <div class="premium-feature-title-area">
          <h3>Custom AI Agent Architect Registry</h3>
          <p>Design, save, and deploy specialized workspace nodes</p>
        </div>
        <div class="premium-grid-2">
          <!-- Form Configurator -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-user-plus" style="color:var(--color-primary);"></i> Agent Schema Builder</h4>
            <div class="premium-form-row">
              <div class="premium-form-group">
                <label>Agent Name</label>
                <input type="text" id="agent-new-name" class="premium-input" placeholder="e.g. UX-Auditor Bot">
              </div>
              <div class="premium-form-group">
                <label>Specialty Role</label>
                <input type="text" id="agent-new-role" class="premium-input" placeholder="e.g. Design Auditor">
              </div>
            </div>
            <div class="premium-form-row">
              <div class="premium-form-group">
                <label>Cost Rate ($/hour)</label>
                <input type="text" id="agent-new-cost" class="premium-input" value="$45">
              </div>
              <div class="premium-form-group">
                <label>Initial Popularity Score (Rating)</label>
                <input type="text" id="agent-new-rating" class="premium-input" value="4.8">
              </div>
            </div>
            <div class="premium-form-group">
              <label>Target System Instructions</label>
              <textarea id="agent-new-prompt" class="premium-textarea" rows="2" placeholder="Analyze viewport containers and report spacing alignment errors..."></textarea>
            </div>
            <button type="button" class="btn-primary" id="btn-agent-registry-deploy">Deploy Agent Registry Checkpoint</button>
          </div>
          <!-- Sort & Dashboard details -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-arrow-down-wide-short" style="color:var(--color-secondary);"></i> Sort Marketplace Grid & Stats</h4>
            <p style="font-size:0.75rem; color:var(--text-secondary);">Organize active marketplace registry agents cards based on metrics criteria:</p>
            <div style="display:flex; gap:10px; width:100%;">
              <button type="button" class="btn-secondary" id="btn-agent-sort-cost" style="flex:1; font-size:0.7rem; padding:8px;">Sort by Hourly Cost</button>
              <button type="button" class="btn-secondary" id="btn-agent-sort-rating" style="flex:1; font-size:0.7rem; padding:8px;">Sort by Performance Rating</button>
            </div>
            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--border-color); padding:12px; border-radius:10px; font-size:0.7rem; margin-top:8px;">
              <div style="display:flex; justify-content:between; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:4px; margin-bottom:4px;">
                <span>Total Registered Assistants:</span>
                <span id="agent-stat-total" style="font-weight:700; color:var(--color-secondary);">9 Active</span>
              </div>
              <div style="display:flex; justify-content:between;">
                <span>Avg Billing Rate:</span>
                <span style="font-weight:700; color:var(--color-success);">$52.50/hr</span>
              </div>
            </div>
          </div>
        </div>
      `;

      // Deploy Custom Agent handler
      document.getElementById('btn-agent-registry-deploy').addEventListener('click', () => {
        const name = document.getElementById('agent-new-name').value.trim();
        const role = document.getElementById('agent-new-role').value.trim();
        const cost = document.getElementById('agent-new-cost').value.trim();
        const rating = document.getElementById('agent-new-rating').value.trim();
        
        if (!name || !role) {
          alert("Agent Name and Specialty Role are required fields!");
          return;
        }

        // Insert new agent card mockup
        const grid = document.querySelector('.agent-grid-large');
        if (grid) {
          const creatorCard = document.getElementById('agent-card-creator');
          const newCard = document.createElement('div');
          newCard.className = 'agent-card-large active';
          newCard.innerHTML = `
            <div class="agent-card-large-top">
              <div class="agent-card-large-icon"><i class="fa-solid fa-robot" style="color:var(--color-primary);"></i></div>
              <div>
                <div class="agent-card-large-title">${name}</div>
                <div class="agent-card-large-desc">${role}</div>
              </div>
            </div>
            <div class="agent-card-large-bottom" style="margin-top:12px; font-size:0.7rem; display:flex; justify-content:between;">
              <span class="status-indicator" style="display:flex; align-items:center; gap:4px;"><span class="status-dot"></span> Online</span>
              <span style="color:#fff; font-weight:700;">${cost}</span>
            </div>
          `;
          grid.insertBefore(newCard, creatorCard);
          
          // Save to safeStorage
          const currentCount = parseInt(safeStorage.getItem('agent_count') || '9');
          safeStorage.setItem('agent_count', String(currentCount + 1));
          document.getElementById('agent-stat-total').innerText = `${currentCount + 1} Active`;

          alert(`Custom Agent [${name}] successfully registered & deployed to active marketplace registry!`);
          logActivity('Marketplace', `Created and registered custom agent workspace node: ${name}`);

          document.getElementById('agent-new-name').value = '';
          document.getElementById('agent-new-role').value = '';
          init3DCardTilt();
        }
      });

      // Sort hourly cost
      document.getElementById('btn-agent-sort-cost').addEventListener('click', () => {
        const grid = document.querySelector('.agent-grid-large');
        if (grid) {
          const cards = Array.from(grid.querySelectorAll('.agent-card-large:not(#agent-card-creator)'));
          cards.sort((a, b) => {
            const costA = parseFloat(a.querySelector('.agent-card-large-bottom span:last-child').innerText.replace(/[^0-9.]/g, '')) || 0;
            const costB = parseFloat(b.querySelector('.agent-card-large-bottom span:last-child').innerText.replace(/[^0-9.]/g, '')) || 0;
            return costA - costB;
          });
          cards.forEach(c => grid.appendChild(c));
          // Always append creator card to the end
          grid.appendChild(document.getElementById('agent-card-creator'));
          alert("Marketplace grid sorted by mock hourly rate (ascending)!");
        }
      });

      // Sort by rating
      document.getElementById('btn-agent-sort-rating').addEventListener('click', () => {
        alert("Marketplace grid sorted by performance rating (descending)!");
      });
    }

    // C. Workflow Builder additions
    const workflowAdditions = document.getElementById('premium-workflow-additions');
    if (workflowAdditions) {
      workflowAdditions.innerHTML = `
        <div class="premium-feature-title-area">
          <h3>Workflow Run Logs & Config Presets</h3>
          <p>Track processing latency and launch template setups</p>
        </div>
        <div class="premium-grid-2">
          <!-- Logs Terminal -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-terminal" style="color:var(--color-success);"></i> Execution Runs Audit Log</h4>
            <div class="premium-log-terminal" id="wf-audit-logs">[INFO] System pipeline online.\n[INFO] Awaiting workflow trigger pulse...</div>
            <button type="button" class="btn-primary" id="btn-wf-clear-logs" style="font-size:0.65rem; padding:6px 12px; align-self:flex-start;">Clear Terminal Logs</button>
          </div>
          <!-- Presets & Validator -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-sitemap" style="color:var(--color-warning);"></i> Pipeline Template Presets</h4>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <button type="button" class="btn-secondary" id="btn-preset-email" style="font-size:0.72rem; text-align:left; padding:8px;"><i class="fa-solid fa-envelope" style="color:#c084fc;"></i> Auto Email Responder Sequence Template</button>
              <button type="button" class="btn-secondary" id="btn-preset-report" style="font-size:0.72rem; text-align:left; padding:8px;"><i class="fa-solid fa-file-chart-column" style="color:#60a5fa;"></i> Weekly Data Analytics Compilation Template</button>
            </div>
            <div style="background:rgba(239, 68, 68, 0.05); border:1px solid rgba(239,68,68,0.2); padding:10px; border-radius:8px; font-size:0.68rem; margin-top:6px;">
              <strong style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Live Validation Status:</strong>
              <div style="color:var(--text-secondary); margin-top:2px;">Warning: 2 connection strings are unrouted inside the editor board.</div>
            </div>
          </div>
        </div>
      `;

      // Clear logs
      document.getElementById('btn-wf-clear-logs').addEventListener('click', () => {
        document.getElementById('wf-audit-logs').textContent = '[INFO] Console log buffer cleared. Awaiting action...';
      });

      // Template presets triggers
      const term = document.getElementById('wf-audit-logs');
      document.getElementById('btn-preset-email').addEventListener('click', () => {
        term.innerHTML += `\n[ACTION] Instantiating preset: Email responder sequence...`;
        term.innerHTML += `\n[SUCCESS] Node created: [Trigger -> Lead Inbound]`;
        term.innerHTML += `\n[SUCCESS] Node created: [Router -> Filter Email Domain]`;
        term.innerHTML += `\n[SUCCESS] Node created: [Action -> Send Templates Invite]`;
        term.scrollTop = term.scrollHeight;
        logActivity('Workflows', 'Injected Auto Email Responder workflow nodes');
      });

      document.getElementById('btn-preset-report').addEventListener('click', () => {
        term.innerHTML += `\n[ACTION] Instantiating preset: Weekly Data Analytics Compilation...`;
        term.innerHTML += `\n[SUCCESS] Node created: [Trigger -> Ingest CRM CSV Table]`;
        term.innerHTML += `\n[SUCCESS] Node created: [Action -> Calculate Mean Averages]`;
        term.innerHTML += `\n[SUCCESS] Node created: [Action -> Export Summary PDF]`;
        term.scrollTop = term.scrollHeight;
        logActivity('Workflows', 'Injected Weekly Analytics workflow nodes');
      });
    }

    // D. AI Chat Assistant additions
    const chatAdditions = document.getElementById('premium-chat-additions');
    if (chatAdditions) {
      chatAdditions.innerHTML = `
        <div class="premium-feature-title-area">
          <h3>Collaborative Multi-Agent War Room & Analysis</h3>
          <p>Prompt multiple personas to debate tasks cooperatively</p>
        </div>
        <div class="premium-grid-2">
          <!-- War Room -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-users-viewfinder" style="color:var(--color-primary);"></i> Multi-Agent Cooperative Chat</h4>
            <div class="premium-form-group">
              <label>Select active agents to discuss prompt</label>
              <select id="chat-agents-select" class="premium-select">
                <option value="dev-qa">UX Architect vs QA Engineer</option>
                <option value="pm-dev">Product Manager vs Frontend Dev</option>
              </select>
            </div>
            <div class="premium-form-group">
              <label>Topic to brainstorm / debate</label>
              <input type="text" id="chat-debate-prompt" class="premium-input" placeholder="e.g. Optimize login latency coordinates...">
            </div>
            <button type="button" class="btn-primary" id="btn-chat-launch-debate">Run Cooperative Debate Session</button>
          </div>
          <!-- Sentiment & Helpers -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-magnifying-glass-chart" style="color:var(--color-secondary);"></i> Real-Time Sentiment & Prompt helpers</h4>
            <div class="premium-form-group">
              <label>Live Sentiment of Input text</label>
              <div class="sentiment-bar-bg" style="margin-top:6px;">
                <div class="sentiment-bar-fill" id="chat-sentiment-bar"></div>
              </div>
              <div style="display:flex; justify-content:between; font-size:0.65rem; color:var(--text-secondary); margin-top:2px;">
                <span>Negative</span>
                <span id="chat-sentiment-lbl">Neutral (50%)</span>
                <span>Positive</span>
              </div>
            </div>
            <div class="premium-form-group">
              <label>System Prompt Templates</label>
              <select id="chat-templates-list" class="premium-select">
                <option value="">-- Choose pre-built templates --</option>
                <option value="debug">Code Bug Finder Expert</option>
                <option value="ux">UX Accessibility Auditor</option>
              </select>
            </div>
          </div>
        </div>
      `;

      // Live Sentiment calculation on chat input change
      const chatInput = document.getElementById('chat-input');
      if (chatInput) {
        chatInput.addEventListener('input', (e) => {
          const val = e.target.value.toLowerCase();
          const scoreBar = document.getElementById('chat-sentiment-bar');
          const scoreLbl = document.getElementById('chat-sentiment-lbl');
          if (!val) {
            scoreBar.style.width = '50%';
            scoreBar.style.backgroundColor = 'var(--color-secondary)';
            scoreLbl.innerText = 'Neutral (50%)';
            return;
          }

          let score = 50;
          const positiveWords = ['good', 'great', 'awesome', 'excellent', 'amazing', 'happy', 'yes', 'cool', 'love', 'fast'];
          const negativeWords = ['bad', 'error', 'slow', 'crash', 'fail', 'poor', 'sad', 'no', 'ugly', 'broken'];
          
          positiveWords.forEach(w => { if(val.includes(w)) score += 10; });
          negativeWords.forEach(w => { if(val.includes(w)) score -= 10; });
          score = Math.max(10, Math.min(90, score));

          scoreBar.style.width = `${score}%`;
          if (score > 60) {
            scoreBar.style.backgroundColor = 'var(--color-success)';
            scoreLbl.innerText = `Positive (${score}%)`;
          } else if (score < 40) {
            scoreBar.style.backgroundColor = 'var(--color-danger)';
            scoreLbl.innerText = `Negative (${score}%)`;
          } else {
            scoreBar.style.backgroundColor = 'var(--color-secondary)';
            scoreLbl.innerText = `Neutral (${score}%)`;
          }
        });
      }

      // Templates selector handler
      const tmplList = document.getElementById('chat-templates-list');
      if (tmplList) {
        tmplList.addEventListener('change', (e) => {
          if (chatInput && e.target.value) {
            if (e.target.value === 'debug') {
              chatInput.value = "[SYSTEM - DEBUG MODE] Please audit the following code block for memory leaks: ";
            } else {
              chatInput.value = "[SYSTEM - UX AUDIT] Review this page interface layout for contrast standard matching: ";
            }
          }
        });
      }

      // Launch Debate session
      document.getElementById('btn-chat-launch-debate').addEventListener('click', () => {
        const topic = document.getElementById('chat-debate-prompt').value.trim();
        const combo = document.getElementById('chat-agents-select').value;
        if (!topic) {
          alert("Debate topic is required!");
          return;
        }

        const chatBox = document.getElementById('chat-messages-container');
        if (!chatBox) return;

        chatBox.innerHTML += `
          <div class="chat-msg bot" style="border:1px dashed var(--color-primary); background:rgba(139,92,246,0.02); margin:8px 0; width:100%;">
            <strong style="color:var(--color-primary);">[SYSTEM DEBATE SESSION INITIATED]</strong>
            <p>Topic: "${topic}"</p>
          </div>
        `;

        setTimeout(() => {
          let reply1 = '';
          let reply2 = '';
          if (combo === 'dev-qa') {
            reply1 = `<strong>[UX Architect]</strong>: "Regarding ${topic}, I propose adding a grid element on the screen. It distributes visually and aligns cleanly on mobile viewports."`;
            reply2 = `<strong>[QA Engineer]</strong>: "Wait, a grid block increases DOM height. It might cause vertical layout overlaps on small screens. We must write a strict height check."`;
          } else {
            reply1 = `<strong>[Product Manager]</strong>: "To launch ${topic} fast, let's keep the UI simple. Just use static flex boxes and skip secondary metrics tables."`;
            reply2 = `<strong>[Frontend Dev]</strong>: "Static flex blocks are fast, but they won't scale. Let's make it a clean CSS grid layout, and populate values dynamically."`;
          }

          chatBox.innerHTML += `
            <div class="chat-msg bot" style="align-self:flex-start; margin-top:6px;">${reply1}</div>
            <div class="chat-msg bot" style="align-self:flex-start; margin-top:6px;">${reply2}</div>
          `;
          chatBox.scrollTop = chatBox.scrollHeight;
          logActivity('Chat', `Initiated Multi-Agent debate session on "${topic}"`);
        }, 1000);
      });
    }

    // E. Data Analyzer / Forecaster additions
    const analyticsAdditions = document.getElementById('premium-analytics-additions');
    if (analyticsAdditions) {
      analyticsAdditions.innerHTML = `
        <div class="premium-feature-title-area">
          <h3>Local CSV Auto-Plotter & Forecasting Control</h3>
          <p>Upload text files to build visual CSS bars and detect outliers</p>
        </div>
        <div class="premium-grid-2">
          <!-- Auto-Plotter -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-chart-simple" style="color:var(--color-primary);"></i> CSV Auto-Plotting Engine</h4>
            <div class="premium-form-group">
              <label>Input mock CSV data (columns: label, value)</label>
              <textarea id="analytics-csv-input" class="premium-textarea" rows="3">Mon,45\nTue,90\nWed,120\nThu,75\nFri,150</textarea>
            </div>
            <button type="button" class="btn-primary" id="btn-analytics-plot">Auto-Plot CSS Bars</button>
            <div id="analytics-plot-canvas" style="display:none; margin-top:10px; background:rgba(0,0,0,0.3); border:1px solid var(--border-color); border-radius:8px; padding:12px;"></div>
          </div>
          <!-- Parameters & Outliers -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-shield-halved" style="color:var(--color-secondary);"></i> Learning Decay & Outlier Check</h4>
            <div class="premium-form-row">
              <div class="premium-form-group">
                <label>Learning Rate Decay</label>
                <input type="range" id="analytics-decay-slider" min="1" max="100" value="85" style="accent-color:var(--color-secondary);">
                <span id="decay-val-lbl" style="font-size:0.6rem; color:var(--text-secondary);">Decay index: 0.85</span>
              </div>
              <div class="premium-form-group">
                <label>Iterative Epochs</label>
                <input type="number" id="analytics-epoch-input" class="premium-input" value="1000" style="padding:6px;">
              </div>
            </div>
            <button type="button" class="btn-secondary" id="btn-analytics-detect-outliers">Analyze Spikes & Outliers</button>
            <div id="analytics-outliers-list" style="display:none; font-size:0.65rem; background:rgba(239, 68, 68, 0.05); border:1px solid rgba(239, 68, 68, 0.15); padding:8px; border-radius:6px; color:#fff; text-align:left;"></div>
          </div>
        </div>
      `;

      // Decay slider label
      document.getElementById('analytics-decay-slider').addEventListener('input', (e) => {
        document.getElementById('decay-val-lbl').innerText = `Decay index: ${(e.target.value / 100).toFixed(2)}`;
      });

      // Plot CSV
      document.getElementById('btn-analytics-plot').addEventListener('click', () => {
        const csv = document.getElementById('analytics-csv-input').value.trim();
        const canvas = document.getElementById('analytics-plot-canvas');
        if (!csv) return;
        
        canvas.style.display = 'block';
        let barHtml = '<div style="display:flex; flex-direction:column; gap:6px; width:100%;">';
        const lines = csv.split('\n');
        lines.forEach(line => {
          const parts = line.split(',');
          if (parts.length >= 2) {
            const label = parts[0];
            const val = parseInt(parts[1]) || 0;
            const widthPct = Math.min(100, Math.max(5, (val / 180) * 100));
            barHtml += `
              <div style="font-size:0.65rem; display:flex; align-items:center; gap:8px;">
                <span style="width:30px; text-align:right;">${label}:</span>
                <div style="flex-grow:1; height:12px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden;">
                  <div style="width:${widthPct}%; height:100%; background:linear-gradient(90deg, var(--color-primary), var(--color-secondary)); border-radius:4px;"></div>
                </div>
                <span style="width:25px;">${val}</span>
              </div>
            `;
          }
        });
        barHtml += '</div>';
        canvas.innerHTML = barHtml;
        logActivity('Analytics', 'Generated custom CSV data CSS charts representation');
      });

      // Outliers detector
      document.getElementById('btn-analytics-detect-outliers').addEventListener('click', () => {
        const csv = document.getElementById('analytics-csv-input').value.trim();
        const listDiv = document.getElementById('analytics-outliers-list');
        if (!csv) return;

        listDiv.style.display = 'block';
        const lines = csv.split('\n');
        let outliers = [];
        let total = 0;
        let vals = [];

        lines.forEach(line => {
          const parts = line.split(',');
          if (parts.length >= 2) {
            const val = parseInt(parts[1]) || 0;
            vals.push({lbl: parts[0], val: val});
            total += val;
          }
        });

        const avg = total / vals.length;
        vals.forEach(item => {
          if (item.val > avg * 1.35 || item.val < avg * 0.6) {
            outliers.push(`[ANOMALY] Spikes found on ${item.lbl}: value ${item.val} deviates from mean average (${avg.toFixed(1)})`);
          }
        });

        if (outliers.length > 0) {
          listDiv.innerHTML = outliers.map(o => `<div style="margin-bottom:3px;"><i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;"></i> ${o}</div>`).join('');
        } else {
          listDiv.innerHTML = '<div style="color:var(--color-success);"><i class="fa-solid fa-circle-check"></i> Standard variance detected. Zero outliers.</div>';
        }
      });
    }

    // F. Seamless Integrations additions
    const integrationsAdditions = document.getElementById('premium-integrations-additions');
    if (integrationsAdditions) {
      integrationsAdditions.innerHTML = `
        <div class="premium-feature-title-area">
          <h3>Integrations Headers Custom Request Builder & SSL Checker</h3>
          <p>Test dynamic endpoint routes with custom payload settings</p>
        </div>
        <div class="premium-grid-2">
          <!-- Request Builder -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-globe" style="color:var(--color-primary);"></i> Dynamic API Request Builder</h4>
            <div class="premium-form-row">
              <div class="premium-form-group">
                <label>Target Method</label>
                <select id="int-req-method" class="premium-select">
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                </select>
              </div>
              <div class="premium-form-group" style="flex-grow:2;">
                <label>Route URL</label>
                <input type="text" id="int-req-url" class="premium-input" value="https://api.nexushub.ai/v1/sync">
              </div>
            </div>
            <div class="premium-form-group">
              <label>Custom Headers (JSON)</label>
              <input type="text" id="int-req-headers" class="premium-input" value='{"Content-Type": "application/json", "Authorization": "Bearer nex_key"}'>
            </div>
            <button type="button" class="btn-primary" id="btn-int-req-send">Test Endpoint Connection</button>
            <div id="int-req-console" style="display:none; font-family:monospace; font-size:0.65rem; color:#10b981; padding:8px; background:rgba(0,0,0,0.4); border-radius:6px; border:1px solid var(--border-color); white-space:pre-wrap;"></div>
          </div>
          <!-- SSL Checker & History -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-shield-check" style="color:var(--color-secondary);"></i> SSL Verification & Diagnostic Logs</h4>
            <div class="premium-form-group">
              <label>Target Domain to verify SSL Cert</label>
              <div class="premium-form-row">
                <input type="text" id="int-ssl-domain" class="premium-input" value="api.nexushub.ai">
                <button type="button" class="btn-secondary" id="btn-int-ssl-run" style="padding:8px 12px;">Check SSL</button>
              </div>
            </div>
            <div id="int-ssl-output" style="display:none; font-size:0.65rem; background:rgba(255,255,255,0.02); border:1px solid var(--border-color); padding:8px; border-radius:6px; color:#fff; text-align:left;"></div>
            <div style="margin-top:4px;">
              <h5 style="color:#fff; font-size:0.7rem; font-weight:600; margin-bottom:4px;">Handshake Diagnostic History:</h5>
              <div style="font-size:0.62rem; color:var(--text-secondary);" id="int-ping-history">
                <div>[2026-06-04 16:30] STRIPE - Sync Complete - scope: full (200 OK)</div>
                <div>[2026-06-04 16:32] SLACK - Ping Verified - scope: delta (200 OK)</div>
              </div>
            </div>
          </div>
        </div>
      `;

      // Request Builder Send
      document.getElementById('btn-int-req-send').addEventListener('click', () => {
        const method = document.getElementById('int-req-method').value;
        const url = document.getElementById('int-req-url').value;
        const consoleDiv = document.getElementById('int-req-console');
        
        consoleDiv.style.display = 'block';
        consoleDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Triggering API handshake pulse...';
        
        setTimeout(() => {
          consoleDiv.innerHTML = `[SUCCESS] Status: 200 OK\n[INFO] Method: ${method}\n[INFO] Endpoint resolved: ${url}\n[INFO] Payload Signature authenticated. Tunnel secure.`;
          
          const hist = document.getElementById('int-ping-history');
          hist.innerHTML = `<div>[${new Date().toLocaleTimeString()}] CUSTOM - ${method} Verified - route: ${url} (200 OK)</div>` + hist.innerHTML;
          logActivity('Integrations', `Ran request builder test sync for endpoint ${url}`);
        }, 1100);
      });

      // SSL Check run
      document.getElementById('btn-int-ssl-run').addEventListener('click', () => {
        const domain = document.getElementById('int-ssl-domain').value;
        const out = document.getElementById('int-ssl-output');
        out.style.display = 'block';
        out.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Resolving certificate authorities...';
        
        setTimeout(() => {
          out.innerHTML = `
            <div style="color:var(--color-success); font-weight:700;"><i class="fa-solid fa-circle-check"></i> SSL Certificate Valid!</div>
            <div style="margin-top:2px;">Issued By: Let's Encrypt Authority X3</div>
            <div>Expiry: 90 Days remaining (Valid until Sept 2026)</div>
            <div>Encryption standard: TLSv1.3 (256-bit AES)</div>
          `;
          logActivity('Integrations', `Executed SSL certificate diagnostic checks for ${domain}`);
        }, 800);
      });
    }

    // G. Knowledge Base additions
    const kbAdditions = document.getElementById('premium-kb-additions');
    if (kbAdditions) {
      kbAdditions.innerHTML = `
        <div class="premium-feature-title-area">
          <h3>One-Click Ingest Summarizer & Schema Mapping</h3>
          <p>Condense parsed document context and visualize table mappings</p>
        </div>
        <div class="premium-grid-3">
          <!-- Text Summarizer -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-indent" style="color:var(--color-primary);"></i> One-Click Summarizer</h4>
            <p style="font-size:0.7rem; color:var(--text-secondary);">Select staged repository document content to run semantic AI summaries:</p>
            <button type="button" class="btn-primary" id="btn-kb-summarize" style="font-size:0.7rem; padding:8px;">Summarize Database Docs</button>
            <div id="kb-summary-output" style="display:none; font-size:0.68rem; background:rgba(0,0,0,0.3); border:1px solid var(--border-color); padding:8px; border-radius:6px; color:var(--text-secondary);"></div>
          </div>
          <!-- Schema Mapping Visualizer -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-network-wired" style="color:var(--color-secondary);"></i> Extraction Schema Tree</h4>
            <div id="kb-schema-tree" style="background:rgba(0,0,0,0.2); border:1px solid var(--border-color); padding:10px; border-radius:8px; font-size:0.6rem; font-family:monospace; color:#a7f3d0; text-align:left;">
              <div>Root File: Ingested_Schema</div>
              <div style="padding-left:12px;">└── Metadata (Table layout)</div>
              <div style="padding-left:24px;">├── Rows_Parsed: 142</div>
              <div style="padding-left:24px;">└── Columns_Map: [date, amount, status]</div>
            </div>
            <button type="button" class="btn-secondary" id="btn-kb-schema-refresh" style="font-size:0.65rem; padding:6px;">Re-map Database Schema</button>
          </div>
          <!-- OCR Document Ingest -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-qrcode" style="color:var(--color-warning);"></i> OCR Scanner Ingest</h4>
            <div style="border:1px dashed var(--border-color); background:rgba(0,0,0,0.2); border-radius:8px; padding:12px; text-align:center; font-size:0.65rem; cursor:pointer;" id="kb-ocr-dropzone">
              <i class="fa-solid fa-camera-retro" style="font-size:1.5rem; color:var(--color-warning); margin-bottom:4px;"></i>
              <div>Upload scanned PNG/JPG invoice images to mockup metadata</div>
            </div>
            <div id="kb-ocr-output" style="display:none; font-family:monospace; font-size:0.6rem; color:#10b981; margin-top:4px;"></div>
          </div>
        </div>
      `;

      // Text Summarizer
      document.getElementById('btn-kb-summarize').addEventListener('click', () => {
        const out = document.getElementById('kb-summary-output');
        out.style.display = 'block';
        out.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Condensing document tokens...';
        
        setTimeout(() => {
          out.innerHTML = `
            <strong style="color:#fff;">Semantic Doc Summary:</strong>
            <ul style="margin-top:4px; padding-left:12px;">
              <li>Main Scope: Ingested corporate spreadsheets mapping customer support tickets resolution times.</li>
              <li>Outliers Key: 4 spikes identified during the first week of training sessions.</li>
            </ul>
          `;
          logActivity('Knowledge Base', 'Generated text summaries for database staged document files');
        }, 1100);
      });

      // OCR Ingest
      document.getElementById('kb-ocr-dropzone').addEventListener('click', () => {
        const out = document.getElementById('kb-ocr-output');
        out.style.display = 'block';
        out.innerHTML = '[INFO] Processing dynamic OCR characters detection...';
        setTimeout(() => {
          out.innerHTML = `[OCR SUCCESS]\nMetadata read from scan:\n- Provider: Acme Corp Invoice\n- Date: 2026-05-30\n- Amount Due: $1,250.00\n- Status: Unpaid`;
          logActivity('Knowledge Base', 'Processed dynamic OCR character scans for staged document');
        }, 1000);
      });

      // Refresh Schema Mapping
      document.getElementById('btn-kb-schema-refresh').addEventListener('click', () => {
        alert("Extraction schema mapped successfully against local database collections!");
      });
    }

    // H. Advanced AI features additions
    const advancedAdditions = document.getElementById('premium-advanced-additions');
    if (advancedAdditions) {
      advancedAdditions.innerHTML = `
        <div class="premium-feature-title-area">
          <h3>LLM Optimizer, Weights Parameters & Distance Heatmap</h3>
          <p>Tweak model training matrices and visualize semantic weights closeness</p>
        </div>
        <div class="premium-grid-3">
          <!-- LLM Prompt Optimizer -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-wand-magic" style="color:var(--color-primary);"></i> Prompt Optimizer</h4>
            <div class="premium-form-group">
              <label>Draft System Instructions Prompt</label>
              <textarea id="adv-prompt-draft" class="premium-textarea" rows="2" style="font-size:0.7rem;">Write a code analyzer that finds loops.</textarea>
            </div>
            <button type="button" class="btn-primary" id="btn-adv-opt" style="font-size:0.7rem; padding:8px;">Optimize Prompt</button>
            <div id="adv-opt-output" style="display:none; font-size:0.68rem; background:rgba(0,0,0,0.3); border:1px solid var(--border-color); padding:8px; border-radius:6px; color:#10b981; margin-top:6px;"></div>
          </div>
          <!-- Hyperparameter Epoch/Batch -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-sliders" style="color:var(--color-secondary);"></i> Weights Matrix Grid</h4>
            <div class="premium-form-row">
              <div class="premium-form-group">
                <label>Batch Size</label>
                <select id="adv-batch-size" class="premium-select" style="padding:6px; font-size:0.7rem;">
                  <option value="16">16</option>
                  <option value="32" selected>32</option>
                  <option value="64">64</option>
                </select>
              </div>
              <div class="premium-form-group">
                <label>Gradient Accum</label>
                <select id="adv-grad-accum" class="premium-select" style="padding:6px; font-size:0.7rem;">
                  <option value="1">1</option>
                  <option value="2" selected>2</option>
                  <option value="4">4</option>
                </select>
              </div>
            </div>
            <div class="premium-form-group">
              <label>Learning Optimizer Rate</label>
              <select id="adv-optimizer" class="premium-select" style="padding:6px; font-size:0.7rem;">
                <option value="adamw">AdamW v2.0</option>
                <option value="sgd">SGD Classical</option>
                <option value="rmsprop">RMSprop</option>
              </select>
            </div>
            <button type="button" class="btn-secondary" id="btn-adv-weights-save" style="font-size:0.65rem; padding:6px;">Save Hyperparameters</button>
          </div>
          <!-- Semantic Distance Heatmap -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-table-cells" style="color:var(--color-warning);"></i> Semantic Distance Heatmap</h4>
            <div class="heatmap-grid" id="adv-heatmap-grid">
              <div class="heatmap-cell" style="background:rgba(139,92,246,0.95);">0.95</div>
              <div class="heatmap-cell" style="background:rgba(139,92,246,0.7);">0.70</div>
              <div class="heatmap-cell" style="background:rgba(139,92,246,0.4);">0.42</div>
              <div class="heatmap-cell" style="background:rgba(139,92,246,0.1);">0.15</div>
              <div class="heatmap-cell" style="background:rgba(139,92,246,0.6);">0.68</div>
              <div class="heatmap-cell" style="background:rgba(139,92,246,0.9);">0.89</div>
              <div class="heatmap-cell" style="background:rgba(139,92,246,0.5);">0.55</div>
              <div class="heatmap-cell" style="background:rgba(139,92,246,0.22);">0.22</div>
            </div>
            <button type="button" class="btn-secondary" id="btn-adv-heatmap-shuffle" style="font-size:0.65rem; padding:6px; margin-top:8px;">Recalculate Proximities</button>
          </div>
        </div>
      `;

      // Prompt Optimizer
      document.getElementById('btn-adv-opt').addEventListener('click', () => {
        const val = document.getElementById('adv-prompt-draft').value;
        const out = document.getElementById('adv-opt-output');
        out.style.display = 'block';
        out.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Structuring prompt AST nodes...';
        
        setTimeout(() => {
          out.innerHTML = `<strong>Optimized Prompt:</strong><br>"You are an expert static analysis compiler. Parse the target code, construct an Abstract Syntax Tree (AST), isolate all loop structures (for, while), and detect infinite conditions or leak variables."`;
          logActivity('Advanced Features', `Optimized prompt: "${val}"`);
        }, 950);
      });

      // Hyperparameters save
      document.getElementById('btn-adv-weights-save').addEventListener('click', () => {
        const batch = document.getElementById('adv-batch-size').value;
        const grad = document.getElementById('adv-grad-accum').value;
        const opt = document.getElementById('adv-optimizer').value;
        alert(`Model training checkpoints weights saved!\n- Batch Size: ${batch}\n- Gradient Accumulation: ${grad}\n- Optimizer: ${opt}`);
        logActivity('Advanced Features', `Configured batch size ${batch} and optimizer ${opt}`);
      });

      // Heatmap shuffle
      document.getElementById('btn-adv-heatmap-shuffle').addEventListener('click', () => {
        const cells = document.querySelectorAll('#adv-heatmap-grid .heatmap-cell');
        cells.forEach(cell => {
          const val = Math.random();
          cell.innerText = val.toFixed(2);
          cell.style.background = `rgba(139,92,246, ${Math.max(0.1, val)})`;
        });
        logActivity('Advanced Features', 'Recalculated semantic distance weights proximity vectors');
      });
    }

    // I. Website Builder additions
    const webAdditions = document.getElementById('premium-web-additions');
    if (webAdditions) {
      webAdditions.innerHTML = `
        <div class="premium-feature-title-area">
          <h3>DNS Simulator Lookup, Tailwind Toggles & Speed Metrics</h3>
          <p>Configure DNS domain records and calculate loading speeds</p>
        </div>
        <div class="premium-grid-3">
          <!-- DNS Lookup -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-globe" style="color:var(--color-primary);"></i> Domain DNS Lookup</h4>
            <div class="premium-form-group">
              <label>Target Domain URL</label>
              <div class="premium-form-row">
                <input type="text" id="web-dns-domain" class="premium-input" value="nexushub-site.net">
                <button type="button" class="btn-primary" id="btn-web-dns-run" style="padding:8px 12px;">Resolve</button>
              </div>
            </div>
            <div id="web-dns-output" style="display:none; font-family:monospace; font-size:0.62rem; color:#10b981;"></div>
          </div>
          <!-- Tailwind Toggle -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-compass-drafting" style="color:var(--color-secondary);"></i> Tailwind Framework Injector</h4>
            <p style="font-size:0.7rem; color:var(--text-secondary);">Enable Tailwind styling compiler to build beautiful fluid layouts:</p>
            <div style="display:flex; align-items:center; gap:8px;">
              <label class="switch">
                <input type="checkbox" id="web-tailwind-toggle" checked>
                <span class="slider"></span>
              </label>
              <span style="font-size:0.75rem; color:#fff;">Tailwind v3.4 Active</span>
            </div>
            <div style="font-size:0.6rem; color:var(--text-secondary); margin-top:2px;">Automatically adds utility-first class rules inside previews.</div>
          </div>
          <!-- Performance Metrics -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-gauge-high" style="color:var(--color-warning);"></i> Loading Speed Calculator</h4>
            <button type="button" class="btn-secondary" id="btn-web-speed-calc" style="font-size:0.65rem; padding:8px;">Run Lighthouse Speed Test</button>
            <div id="web-speed-output" style="display:none; font-size:0.65rem; background:rgba(0,0,0,0.3); border:1px solid var(--border-color); padding:8px; border-radius:6px; color:#fff; text-align:left;"></div>
          </div>
        </div>
      `;

      // DNS Lookup resolve
      document.getElementById('btn-web-dns-run').addEventListener('click', () => {
        const domain = document.getElementById('web-dns-domain').value;
        const out = document.getElementById('web-dns-output');
        out.style.display = 'block';
        out.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Resolving records...';
        
        setTimeout(() => {
          out.innerHTML = `[DNS RECORDS RESOLVED]\nType: A\nIP Target: 104.21.90.11\nTTL: 3600\nType: CNAME\nAlias: cname.netlify.com`;
          logActivity('Web Builder', `Resolved DNS server registry records for ${domain}`);
        }, 900);
      });

      // Speed test calculator
      document.getElementById('btn-web-speed-calc').addEventListener('click', () => {
        const out = document.getElementById('web-speed-output');
        out.style.display = 'block';
        out.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Audit index compile...';
        
        setTimeout(() => {
          out.innerHTML = `
            <strong style="color:var(--color-success);"><i class="fa-solid fa-circle-check"></i> Audit Complete!</strong>
            <div style="margin-top:2px;">Performance Score: 98/100</div>
            <div>Accessibility Score: 95/100</div>
            <div>Time to First Contentful Paint: 0.4s</div>
          `;
          logActivity('Web Builder', 'Completed Lighthouse performance diagnostics for mock website');
        }, 1100);
      });
    }

    // J. Proposal Generator additions
    const proposalAdditions = document.getElementById('premium-proposal-additions');
    if (proposalAdditions) {
      proposalAdditions.innerHTML = `
        <div class="premium-feature-title-area">
          <h3>E-Signature Pad, Multi-Currency Switcher & Fee Tax Modifier</h3>
          <p>Sign contract documents using touch inputs and calculate tax fees</p>
        </div>
        <div class="premium-grid-3">
          <!-- Currency Switcher -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-money-bill-transfer" style="color:var(--color-primary);"></i> Multi-Currency Converter</h4>
            <div class="premium-form-row">
              <div class="premium-form-group">
                <label>Select Target Currency</label>
                <select id="prop-currency-select" class="premium-select" style="padding:6px; font-size:0.7rem;">
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
              <div class="premium-form-group">
                <label>Budget amount</label>
                <input type="text" id="prop-currency-val" class="premium-input" value="8500" style="padding:6px;">
              </div>
            </div>
            <button type="button" class="btn-primary" id="btn-prop-currency-calc" style="font-size:0.65rem; padding:8px;">Convert Budget Table</button>
            <div id="prop-currency-output" style="display:none; font-size:0.68rem; font-weight:700; color:var(--color-success);"></div>
          </div>
          <!-- Signature Pad -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-signature" style="color:var(--color-secondary);"></i> Draw Signature Pad</h4>
            <div class="signature-pad-wrapper">
              <canvas id="signature-canvas" class="signature-pad-canvas" width="220" height="120"></canvas>
            </div>
            <button type="button" class="btn-secondary" id="btn-signature-clear" style="font-size:0.6rem; padding:6px; align-self:flex-start;">Clear Signature</button>
          </div>
          <!-- Tax adjustments -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-percent" style="color:var(--color-warning);"></i> Tax & Discount Modifiers</h4>
            <div class="premium-form-row">
              <div class="premium-form-group">
                <label>Tax Rate (%)</label>
                <input type="text" id="prop-tax-pct" class="premium-input" value="18" style="padding:6px;">
              </div>
              <div class="premium-form-group">
                <label>Discount (%)</label>
                <input type="text" id="prop-discount-pct" class="premium-input" value="5" style="padding:6px;">
              </div>
            </div>
            <button type="button" class="btn-secondary" id="btn-prop-modifier-run" style="font-size:0.65rem; padding:8px;">Compute Adjustments</button>
            <div id="prop-modifier-output" style="display:none; font-size:0.65rem; background:rgba(0,0,0,0.3); border:1px solid var(--border-color); padding:8px; border-radius:6px; color:#fff; text-align:left;"></div>
          </div>
        </div>
      `;

      // Currency converter
      document.getElementById('btn-prop-currency-calc').addEventListener('click', () => {
        const cur = document.getElementById('prop-currency-select').value;
        const val = parseFloat(document.getElementById('prop-currency-val').value) || 0;
        const output = document.getElementById('prop-currency-output');
        output.style.display = 'block';
        
        let rate = 1;
        let symbol = '$';
        if (cur === 'EUR') { rate = 0.92; symbol = '€'; }
        else if (cur === 'INR') { rate = 83.50; symbol = '₹'; }
        else if (cur === 'GBP') { rate = 0.78; symbol = '£'; }

        const result = val * rate;
        output.innerText = `Converted Budget: ${symbol}${result.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} ${cur}`;
        logActivity('Proposal Gen', `Converted contract currency table budget values to: ${cur}`);
      });

      // Signature Pad events
      const canvas = document.getElementById('signature-canvas');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        let drawing = false;

        // Mouse events
        canvas.addEventListener('mousedown', (e) => {
          drawing = true;
          ctx.beginPath();
          ctx.moveTo(e.offsetX, e.offsetY);
        });
        canvas.addEventListener('mousemove', (e) => {
          if (drawing) {
            ctx.lineTo(e.offsetX, e.offsetY);
            ctx.strokeStyle = '#c084fc';
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.stroke();
          }
        });
        canvas.addEventListener('mouseup', () => drawing = false);
        canvas.addEventListener('mouseleave', () => drawing = false);

        // Clear signature
        document.getElementById('btn-signature-clear').addEventListener('click', () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          logActivity('Proposal Gen', 'Cleared custom signature drawings');
        });
      }

      // Modifier calculator
      document.getElementById('btn-prop-modifier-run').addEventListener('click', () => {
        const tax = parseFloat(document.getElementById('prop-tax-pct').value) || 0;
        const discount = parseFloat(document.getElementById('prop-discount-pct').value) || 0;
        const base = parseFloat(document.getElementById('prop-currency-val').value) || 0;
        const output = document.getElementById('prop-modifier-output');
        output.style.display = 'block';

        const discAmount = base * (discount / 100);
        const subtotal = base - discAmount;
        const taxAmount = subtotal * (tax / 100);
        const total = subtotal + taxAmount;

        output.innerHTML = `
          <div>Subtotal (less ${discount}% disc): $${subtotal.toFixed(2)}</div>
          <div>Tax amount (${tax}%): $${taxAmount.toFixed(2)}</div>
          <strong style="color:var(--color-success);">Grand Total: $${total.toFixed(2)}</strong>
        `;
        logActivity('Proposal Gen', 'Recalculated proposal tax & discount fees modifiers');
      });
    }

    // I. Resume Analyzer additions
    const resumeAdditions = document.getElementById('premium-resume-additions');
    if (resumeAdditions) {
      resumeAdditions.innerHTML = `
        <div class="premium-feature-title-area">
          <h3>Cover Letter Generator, Competency Matrix & Target ATS Keywords</h3>
          <p>Extract competency scores and draft cover letters automatically</p>
        </div>
        <div class="premium-grid-3">
          <!-- Cover Letter Drafter -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-file-pen" style="color:var(--color-primary);"></i> Pitch Cover Letter Creator</h4>
            <button type="button" class="btn-primary" id="btn-resume-letter" style="font-size:0.7rem; padding:8px;">Draft Cover Letter</button>
            <div id="resume-letter-output" style="display:none; font-size:0.68rem; background:rgba(0,0,0,0.3); border:1px solid var(--border-color); padding:8px; border-radius:6px; color:var(--text-secondary); max-height:100px; overflow-y:auto;"></div>
          </div>
          <!-- Competency Matrix -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-circle-nodes" style="color:var(--color-secondary);"></i> Core Competency Matrix</h4>
            <div style="display:flex; flex-direction:column; gap:6px; font-size:0.65rem;">
              <div>
                <span>AI Engineering Architecture: 92%</span>
                <div class="competency-bar-bg"><div class="competency-bar-fill" style="width:92%; background:var(--color-primary);"></div></div>
              </div>
              <div>
                <span>Frontend Design Responsiveness: 80%</span>
                <div class="competency-bar-bg"><div class="competency-bar-fill" style="width:80%; background:var(--color-secondary);"></div></div>
              </div>
              <div>
                <span>System Pipeline Integrations: 75%</span>
                <div class="competency-bar-bg"><div class="competency-bar-fill" style="width:75%; background:#10b981;"></div></div>
              </div>
            </div>
          </div>
          <!-- Target Keywords -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-tags" style="color:var(--color-warning);"></i> Target ATS Keywords Checklist</h4>
            <div style="display:flex; flex-wrap:wrap; gap:4px; font-size:0.6rem;">
              <span style="background:rgba(16,185,129,0.1); border:1px solid #10b981; color:#10b981; padding:2px 6px; border-radius:4px;"><i class="fa-solid fa-check"></i> NLP Parsing</span>
              <span style="background:rgba(16,185,129,0.1); border:1px solid #10b981; color:#10b981; padding:2px 6px; border-radius:4px;"><i class="fa-solid fa-check"></i> TensorFlow</span>
              <span style="background:rgba(239,68,68,0.1); border:1px solid #ef4444; color:#ef4444; padding:2px 6px; border-radius:4px;"><i class="fa-solid fa-xmark"></i> WebGL shader</span>
              <span style="background:rgba(16,185,129,0.1); border:1px solid #10b981; color:#10b981; padding:2px 6px; border-radius:4px;"><i class="fa-solid fa-check"></i> CSS Grid</span>
            </div>
            <div style="font-size:0.6rem; color:var(--text-secondary); margin-top:4px;">Warning: Missing WebGL shader terms inside candidate details.</div>
          </div>
        </div>
      `;

      // Cover letter generate
      document.getElementById('btn-resume-letter').addEventListener('click', () => {
        const out = document.getElementById('resume-letter-output');
        out.style.display = 'block';
        out.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Writing cover letter...';
        
        setTimeout(() => {
          out.innerHTML = `<strong>Dear Hiring Manager,</strong><br>I am writing to express my strong interest in the AI Solutions Architect position at your company. With my competency score in AI Architecture (92%) and Frontend design, I am confident in my ability to build robust, automated client workspaces...`;
          logActivity('Resume Analyzer', 'Drafted personalized application cover letter');
        }, 1000);
      });
    }

    // J. Interview Simulator additions
    const interviewAdditions = document.getElementById('premium-interview-additions');
    if (interviewAdditions) {
      interviewAdditions.innerHTML = `
        <div class="premium-feature-title-area">
          <h3>Vocal Stress Pacing Analyzer & Company Scenarios</h3>
          <p>Track answers speech metrics and isolate corporate presets</p>
        </div>
        <div class="premium-grid-3">
          <!-- Speech stress -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-headset" style="color:var(--color-primary);"></i> Vocal Pacing Stress Gauge</h4>
            <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:8px; font-size:0.75rem; text-align:center;">
              <div style="font-weight:700; color:var(--color-secondary); font-size:1.1rem;" id="speech-stress-val">Standard (0.43)</div>
              <div style="font-size:0.65rem; color:var(--text-secondary); margin-top:2px;">WPM Pace: 132 words/minute</div>
            </div>
            <button type="button" class="btn-secondary" id="btn-speech-stress-test" style="font-size:0.65rem; padding:6px;">Analyze Mic Variance</button>
          </div>
          <!-- Company selector -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-building-user" style="color:var(--color-secondary);"></i> Company Scenario Packages</h4>
            <div class="premium-form-group">
              <label>Select Corporate Pipeline Target</label>
              <select id="interview-company-niche" class="premium-select" style="padding:6px; font-size:0.7rem;">
                <option value="google">Google - Tech Architect</option>
                <option value="stripe">Stripe - Developer Advocate</option>
                <option value="netflix">Netflix - UI Engineer</option>
              </select>
            </div>
            <button type="button" class="btn-primary" id="btn-interview-company-save" style="font-size:0.65rem; padding:8px;">Load Company Presets</button>
          </div>
          <!-- Evaluation indicator -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-graduation-cap" style="color:var(--color-warning);"></i> Live Evaluation Card Tags</h4>
            <div style="display:flex; flex-direction:column; gap:4px; font-size:0.65rem;" id="interview-eval-badge-list">
              <div style="background:rgba(16,185,129,0.08); border:1px solid #10b981; color:#10b981; padding:4px 8px; border-radius:6px;">[Q1 - Grammar]: Verified Core Correct</div>
              <div style="background:rgba(16,185,129,0.08); border:1px solid #10b981; color:#10b981; padding:4px 8px; border-radius:6px;">[Q1 - Content]: High Relevance Match</div>
            </div>
          </div>
        </div>
      `;

      // Speech stress analyze
      document.getElementById('btn-speech-stress-test').addEventListener('click', () => {
        const valDiv = document.getElementById('speech-stress-val');
        valDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Reading waveform files...';
        
        setTimeout(() => {
          valDiv.innerHTML = `Ideal (0.28)`;
          logActivity('Interview Prep', 'Analyzed sound frequency files for stress variance indices');
        }, 900);
      });

      // Company select save
      document.getElementById('btn-interview-company-save').addEventListener('click', () => {
        const val = document.getElementById('interview-company-niche').value;
        alert(`Company presets loaded! Custom questions for ${val.toUpperCase()} are now configured inside the simulator target settings.`);
        logActivity('Interview Prep', `Loaded interview company scenario pipeline: ${val}`);
      });
    }

    // K. Open Innovation Lab additions
    const labAdditions = document.getElementById('premium-lab-additions');
    if (labAdditions) {
      labAdditions.innerHTML = `
        <div class="premium-feature-title-area">
          <h3>Validation Dataset Splits & Checkpoint Weights JSON Exporter</h3>
          <p>Manage model weights distributions and export compiled model settings</p>
        </div>
        <div class="premium-grid-2">
          <!-- Validation grid -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-chart-column" style="color:var(--color-primary);"></i> Dataset Validation Split ratio</h4>
            <div class="premium-form-row" style="align-items:center;">
              <div class="premium-form-group">
                <label>Train Ratio (%)</label>
                <input type="number" id="lab-train-ratio" class="premium-input" value="80">
              </div>
              <div class="premium-form-group">
                <label>Validation Ratio (%)</label>
                <input type="number" id="lab-val-ratio" class="premium-input" value="20">
              </div>
            </div>
            <button type="button" class="btn-primary" id="btn-lab-split-save">Save Partition Split</button>
            <div style="background:rgba(255,255,255,0.02); height:12px; border-radius:999px; overflow:hidden; display:flex; margin-top:8px;" id="lab-split-bar">
              <div style="width:80%; height:100%; background:var(--color-primary);"></div>
              <div style="width:20%; height:100%; background:var(--color-secondary);"></div>
            </div>
          </div>
          <!-- weights downloader -->
          <div class="premium-widget-card">
            <h4 style="color:#fff; font-size:0.88rem; font-weight:700;"><i class="fa-solid fa-file-export" style="color:var(--color-secondary);"></i> Model Checkpoint Exporter</h4>
            <p style="font-size:0.7rem; color:var(--text-secondary);">Export the currently active compiled model parameters configuration data as a JSON file:</p>
            <button type="button" class="btn-secondary" id="btn-lab-weights-download"><i class="fa-solid fa-circle-down"></i> Export Checkpoint JSON</button>
          </div>
        </div>
      `;

      // Split save and render bar
      document.getElementById('btn-lab-split-save').addEventListener('click', () => {
        const train = parseFloat(document.getElementById('lab-train-ratio').value) || 80;
        const val = parseFloat(document.getElementById('lab-val-ratio').value) || 20;

        if (train + val !== 100) {
          alert("Error: Splitting proportions must total 100%!");
          return;
        }

        const bar = document.getElementById('lab-split-bar');
        bar.innerHTML = `
          <div style="width:${train}%; height:100%; background:var(--color-primary);"></div>
          <div style="width:${val}%; height:100%; background:var(--color-secondary);"></div>
        `;
        alert(`Validation partitions updated! Train: ${train}%, Validation: ${val}%`);
        logActivity('Innovation Lab', `Updated dataset validation split proportion to ${train}/${val}`);
      });

      // Checkpoint JSON download
      document.getElementById('btn-lab-weights-download').addEventListener('click', () => {
        const model = document.getElementById('lab-model-panel').value;
        const dataset = document.getElementById('lab-dataset-panel').value;
        const lr = document.getElementById('lab-lr-panel').value;

        const configData = {
          nexushub_model_version: "v3.0-Instruct-FineTuned",
          base_model: model,
          dataset_origin: dataset,
          learning_rate: lr,
          compiled_epochs: 3,
          quantization: "4-bit NF4",
          weights_checksum: "sha256_" + Math.random().toString(36).substring(7)
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(configData, null, 2));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", `nexushub_weights_${model}_${dataset}.json`);
        dlAnchorElem.click();
        logActivity('Innovation Lab', `Downloaded model fine-tuning weights configuration JSON: ${model}`);
      });
    }
  }

  function initSettingsExtensions() {
    // 1. 2FA OTP Simulator
    const enable2fa = document.getElementById('settings-enable-2fa');
    const otpContainer = document.getElementById('settings-2fa-otp-container');
    const otpVal = document.getElementById('settings-2fa-otp-val');
    let otpInterval = null;

    if (enable2fa && otpContainer && otpVal) {
      enable2fa.addEventListener('change', (e) => {
        if (e.target.checked) {
          otpContainer.style.display = 'block';
          const genOtp = () => {
            const code = Math.floor(100000 + Math.random() * 900000);
            otpVal.innerText = String(code).replace(/(\d{3})(\d{3})/, '$1 $2');
          };
          genOtp();
          otpInterval = setInterval(genOtp, 10000);
          logActivity('Settings', 'Activated 2FA simulator authentication tokens');
        } else {
          otpContainer.style.display = 'none';
          if (otpInterval) clearInterval(otpInterval);
        }
      });
    }

    // 2. Session timeout slider
    const timeoutSlider = document.getElementById('settings-session-timeout');
    const timeoutVal = document.getElementById('settings-timeout-val');
    if (timeoutSlider && timeoutVal) {
      timeoutSlider.addEventListener('input', (e) => {
        timeoutVal.innerText = `${e.target.value}m`;
      });
    }

    // 3. Telemetry Rate Slider
    const telSlider = document.getElementById('settings-telemetry-rate');
    const telVal = document.getElementById('settings-telemetry-val');
    if (telSlider && telVal) {
      telSlider.addEventListener('input', (e) => {
        telVal.innerText = `${e.target.value}s`;
      });
    }

    // 4. Interface Theme Switcher
    const themeColorSelect = document.getElementById('settings-theme-color');
    if (themeColorSelect) {
      themeColorSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        const root = document.documentElement;
        if (val === 'amber') {
          root.style.setProperty('--color-primary', '#d97706');
          root.style.setProperty('--color-secondary', '#fbbf24');
          root.style.setProperty('--color-primary-rgb', '217, 119, 6');
          logActivity('Settings', 'Interface color theme updated to Solarized Amber');
        } else if (val === 'crimson') {
          root.style.setProperty('--color-primary', '#dc2626');
          root.style.setProperty('--color-secondary', '#f87171');
          root.style.setProperty('--color-primary-rgb', '220, 38, 38');
          logActivity('Settings', 'Interface color theme updated to Crimson Dark');
        } else {
          // default/cyber
          root.style.setProperty('--color-primary', '#8b5cf6');
          root.style.setProperty('--color-secondary', '#06b6d4');
          root.style.setProperty('--color-primary-rgb', '139, 92, 246');
          logActivity('Settings', 'Interface color theme restored to Obsidian Indigo');
        }
      });
    }

    // 5. Logo Uploader
    const logoUpload = document.getElementById('settings-logo-upload');
    if (logoUpload) {
      logoUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(evt) {
            const sidebarLogo = document.querySelector('.logo-area i, .logo-area img');
            if (sidebarLogo) {
              const img = document.createElement('img');
              img.src = evt.target.result;
              img.style.width = '24px';
              img.style.height = '24px';
              img.style.borderRadius = '4px';
              sidebarLogo.replaceWith(img);
              logActivity('Settings', 'Uploaded brand customized logo');
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // 6. Markdown Code Font
    const codeFontSelect = document.getElementById('settings-code-font');
    if (codeFontSelect) {
      codeFontSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        const codeAreas = document.querySelectorAll('.playground-form-group textarea, .premium-log-terminal, .drawer-result-box');
        codeAreas.forEach(area => {
          area.style.fontFamily = val;
        });
        logActivity('Settings', `Font family matching set to ${val}`);
      });
    }

    // 7. Text size slider
    const textSizeSlider = document.getElementById('settings-text-size-slider');
    const textSizeVal = document.getElementById('settings-text-size-val');
    if (textSizeSlider && textSizeVal) {
      textSizeSlider.addEventListener('input', (e) => {
        const size = e.target.value;
        textSizeVal.innerText = `${size}px`;
        document.querySelectorAll('.chat-msg, .playground-form-group textarea').forEach(msg => {
          msg.style.fontSize = `${size}px`;
        });
      });
    }

    // 8. Animation Transition speed
    const animSelect = document.getElementById('settings-anim-speed');
    if (animSelect) {
      animSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        document.querySelectorAll('.dashboard-card, .suite-card-large, .agent-card-large').forEach(card => {
          card.style.transition = `transform ${val} ease-out, box-shadow ${val} ease-out`;
        });
        logActivity('Settings', `Card micro-animation scale rate updated: ${val}`);
      });
    }

    // 9. Health report downloader
    const btnHealth = document.getElementById('btn-settings-health-export');
    if (btnHealth) {
      btnHealth.addEventListener('click', () => {
        const info = {
          client_agent: navigator.userAgent,
          platform: navigator.platform,
          storage_used_bytes: JSON.stringify(localStorage).length,
          active_telemetry_lag_ms: document.getElementById('settings-telemetry-interval').value,
          active_autosave_sec: document.getElementById('settings-autosave-interval').value,
          encryption_vault_hash: "sha256_" + Math.random().toString(36).substring(7),
          system_status: "Healthy (100%)",
          loaded_at: new Date().toISOString()
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(info, null, 2));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute("href", dataStr);
        dlAnchor.setAttribute("download", "nexushub_diagnostics_report.json");
        dlAnchor.click();
        logActivity('Settings', 'Downloaded diagnostic platform health report logs');
      });
    }

    // 10. Cache Purger
    const btnPurge = document.getElementById('btn-settings-purge');
    if (btnPurge) {
      btnPurge.addEventListener('click', () => {
        if (confirm("Are you sure you want to clear your local database cache? This will purge all staged files, custom agents, and leads data.")) {
          safeStorage.clear();
          alert("Platform cache successfully purged. Reloading dashboard components...");
          window.location.reload();
        }
      });
    }

    // 11. Live FPS Counter Loop
    const fpsGauge = document.getElementById('settings-fps-gauge');
    const fpsBar = document.getElementById('settings-fps-bar');
    let lastFrameTime = performance.now();
    let frameCount = 0;
    
    function updateFps() {
      if (!fpsGauge) return;
      const now = performance.now();
      frameCount++;
      if (now > lastFrameTime + 1000) {
        const fps = Math.min(60, Math.round((frameCount * 1000) / (now - lastFrameTime)));
        fpsGauge.innerText = String(fps);
        if (fpsBar) {
          fpsBar.style.width = `${(fps / 60) * 100}%`;
          if (fps > 45) fpsBar.style.background = '#10b981';
          else if (fps > 30) fpsBar.style.background = '#fbbf24';
          else fpsBar.style.background = '#ef4444';
        }
        frameCount = 0;
        lastFrameTime = now;
      }
      requestAnimationFrame(updateFps);
    }
    requestAnimationFrame(updateFps);
  }

  function initPortfolioShowcase() {
    // 1. Radar graph canvas rotation logic
    const canvas = document.getElementById('landing-radar-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      let angle = 0;
      let rotSpeed = 0.005;

      const skills = [
        { name: "AI Eng", val: 92 },
        { name: "UI Design", val: 80 },
        { name: "Pipeline", val: 75 },
        { name: "OCR scan", val: 85 },
        { name: "Analytics", val: 90 },
        { name: "Security", val: 70 }
      ];

      canvas.addEventListener('click', (e) => {
        e.stopPropagation();
        rotSpeed = rotSpeed === 0.005 ? 0.03 : 0.005;
      });

      function drawRadar() {
        if (!document.getElementById('landing-radar-canvas')) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        angle += rotSpeed;

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const maxRadius = 70;

        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        for (let j = 1; j <= 3; j++) {
          ctx.beginPath();
          const r = maxRadius * (j / 3);
          for (let i = 0; i < 6; i++) {
            const theta = (i * Math.PI / 3) + angle;
            const x = cx + Math.cos(theta) * r;
            const y = cy + Math.sin(theta) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
        }

        const points = [];
        ctx.strokeStyle = 'var(--color-primary)';
        ctx.fillStyle = 'rgba(139, 92, 246, 0.25)';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const theta = (i * Math.PI / 3) + angle;
          const r = maxRadius * (skills[i].val / 100);
          const x = cx + Math.cos(theta) * r;
          const y = cy + Math.sin(theta) * r;
          points.push({ x: x, y: y, name: skills[i].name });
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = '7px Outfit, sans-serif';
        points.forEach((p, idx) => {
          const labelDist = maxRadius + 12;
          const theta = (idx * Math.PI / 3) + angle;
          const lx = cx + Math.cos(theta) * labelDist - 12;
          const ly = cy + Math.sin(theta) * labelDist + 3;
          ctx.fillText(p.name, lx, ly);
          
          ctx.fillStyle = 'var(--color-secondary)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        });

        requestAnimationFrame(drawRadar);
      }
      drawRadar();
    }

    // 2. Showroom sync
    window.refreshPortfolioShowroom = function() {
      const showroom = document.getElementById('landing-showroom-list');
      const sitesStat = document.getElementById('landing-stat-sites');
      const propsStat = document.getElementById('landing-stat-proposals');
      if (!showroom) return;

      const generatedSites = JSON.parse(safeStorage.getItem('generated_sites') || '[]');
      const generatedProposals = JSON.parse(safeStorage.getItem('generated_proposals') || '[]');

      if (sitesStat) sitesStat.innerText = `${generatedSites.length} Pages`;
      if (propsStat) propsStat.innerText = `${generatedProposals.length} Contracts`;

      if (generatedSites.length === 0 && generatedProposals.length === 0) {
        showroom.innerHTML = `
          <div style="text-align:center; padding:25px; color:var(--text-muted); font-size:0.75rem; width:100%;">
            <i class="fa-solid fa-box-open" style="font-size:1.5rem; margin-bottom:6px; display:block; opacity:0.6;"></i>
            <div>Your showroom is empty. Enter the Workspace to generate dynamic web projects or contracts.</div>
          </div>
        `;
        return;
      }

      let html = '';
      generatedSites.forEach((site, index) => {
        html += `
          <div class="premium-widget-card" style="border-left: 3px solid var(--color-primary); padding:10px 14px; margin-bottom: 6px; background:rgba(255,255,255,0.02); display:flex; justify-content:space-between; align-items:center; border-radius:8px;">
            <div>
              <strong style="color:#fff; font-size:0.75rem;"><i class="fa-solid fa-desktop" style="color:var(--color-primary); margin-right:4px;"></i> ${site.company || 'Business Landing Page'}</strong>
              <div style="font-size:0.6rem; color:var(--text-secondary); margin-top:2px;">Template: ${site.template.toUpperCase()}</div>
            </div>
            <button class="btn-primary" style="font-size:0.58rem; padding:3px 8px; border-radius:6px; cursor:pointer;" onclick="event.stopPropagation(); window.previewPortfolioSite(${index})">Preview</button>
          </div>
        `;
      });

      generatedProposals.forEach((prop, index) => {
        html += `
          <div class="premium-widget-card" style="border-left: 3px solid var(--color-secondary); padding:10px 14px; margin-bottom: 6px; background:rgba(255,255,255,0.02); display:flex; justify-content:space-between; align-items:center; border-radius:8px;">
            <div>
              <strong style="color:#fff; font-size:0.75rem;"><i class="fa-solid fa-file-signature" style="color:var(--color-secondary); margin-right:4px;"></i> Proposal: ${prop.client}</strong>
              <div style="font-size:0.6rem; color:var(--text-secondary); margin-top:2px;">Budget: ${prop.budget}</div>
            </div>
            <button class="btn-secondary" style="font-size:0.58rem; padding:3px 8px; border-radius:6px; cursor:pointer;" onclick="event.stopPropagation(); window.previewPortfolioContract(${index})">View PDF</button>
          </div>
        `;
      });

      showroom.innerHTML = html;
    };

    window.previewPortfolioSite = function(idx) {
      const generatedSites = JSON.parse(safeStorage.getItem('generated_sites') || '[]');
      const site = generatedSites[idx];
      if (site) {
        const isLogged = safeStorage.getItem('auth_user');
        if (isLogged) {
          setStage('dashboard');
          switchTab('web-builder');
          const preview = document.getElementById('web-preview-pane-panel');
          if (preview && site.code) {
            preview.innerHTML = `<iframe class="preview-iframe-wrapper" id="web-builder-iframe" style="width:100%; height:340px; border:none; border-radius:12px; background:#fff;"></iframe>`;
            const iframe = document.getElementById('web-builder-iframe');
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            doc.open();
            doc.write(site.code);
            doc.close();
            logActivity('Portfolio', `Opened portfolio site preview for ${site.company}`);
          }
        } else {
          setStage('auth');
        }
      }
    };

    window.previewPortfolioContract = function(idx) {
      const generatedProposals = JSON.parse(safeStorage.getItem('generated_proposals') || '[]');
      const prop = generatedProposals[idx];
      if (prop) {
        const isLogged = safeStorage.getItem('auth_user');
        if (isLogged) {
          setStage('dashboard');
          switchTab('proposal-generator');
          const preview = document.getElementById('prop-preview-pane-panel');
          if (preview && prop.code) {
            preview.innerHTML = prop.code;
            logActivity('Portfolio', `Opened portfolio contract viewer for ${prop.client}`);
          }
        } else {
          setStage('auth');
        }
      }
    };

    refreshPortfolioShowroom();
  }

  function initProfileCustomizer() {
    const headerBadge = document.getElementById('profile-badge-area');
    const headerAvatar = document.getElementById('header-user-avatar');
    const headerInitials = document.getElementById('header-user-initials');
    const headerName = document.getElementById('header-user-name');

    const modal = document.getElementById('profile-edit-modal-overlay');
    const modalClose = document.getElementById('profile-modal-close-btn');
    const modalPreview = document.getElementById('modal-profile-preview');
    const modalInitials = document.getElementById('modal-profile-initials');
    const modalUpload = document.getElementById('modal-profile-upload');
    const modalName = document.getElementById('modal-profile-name');
    const modalEmail = document.getElementById('modal-profile-email');
    const modalSave = document.getElementById('btn-profile-save');

    const setPreview = document.getElementById('settings-profile-preview');
    const setInitials = document.getElementById('settings-profile-initials');
    const setUpload = document.getElementById('settings-profile-upload');
    const setName = document.getElementById('settings-profile-name');
    const setNiche = document.getElementById('settings-profile-niche');

    let currentAvatarData = "";

    function getCurrentUser() {
      const saved = safeStorage.getItem('auth_user');
      if (saved) {
        try { return JSON.parse(saved); } catch(e) {}
      }
      return {
        name: "Guest User",
        email: "guest@nexushub.ai",
        avatar: "https://randomuser.me/api/portraits/men/32.jpg"
      };
    }

    function updateAvatarView(imgEl, spanEl, avatarSrc, name) {
      if (!imgEl) return;
      const initial = name ? name.trim().charAt(0).toUpperCase() : "G";
      if (spanEl) spanEl.innerText = initial;

      imgEl.onerror = () => {
        imgEl.style.display = 'none';
        if (spanEl) spanEl.style.display = 'flex';
      };

      if (avatarSrc && avatarSrc.trim() !== "") {
        imgEl.src = avatarSrc;
        imgEl.style.display = 'block';
        if (spanEl) spanEl.style.display = 'none';
      } else {
        imgEl.style.display = 'none';
        if (spanEl) spanEl.style.display = 'flex';
      }
    }

    function syncAllProfileViews() {
      const user = getCurrentUser();
      currentAvatarData = user.avatar || "";

      if (headerName) headerName.innerText = user.name;
      updateAvatarView(headerAvatar, headerInitials, user.avatar, user.name);

      if (setName) setName.value = user.name;
      updateAvatarView(setPreview, setInitials, user.avatar, user.name);

      if (modalName) modalName.value = user.name;
      if (modalEmail) modalEmail.value = user.email || "guest@nexushub.ai";
      updateAvatarView(modalPreview, modalInitials, user.avatar, user.name);
      
      const savedNiche = safeStorage.getItem('auth_user_niche') || "Lead Automation Architect";
      if (setNiche) setNiche.value = savedNiche;
    }

    window.syncAllProfileViews = syncAllProfileViews;

    if (headerBadge) {
      headerBadge.addEventListener('click', (e) => {
        if (e.target.closest('#btn-portal-signout')) return;
        syncAllProfileViews();
        if (modal) modal.style.display = 'flex';
      });
    }

    if (modalClose) {
      modalClose.addEventListener('click', () => {
        if (modal) modal.style.display = 'none';
      });
    }
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
    }

    function handlePhotoUpload(file, callback) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        callback(e.target.result);
      };
      reader.readAsDataURL(file);
    }

    if (modalUpload) {
      modalUpload.addEventListener('change', (e) => {
        handlePhotoUpload(e.target.files[0], (base64) => {
          currentAvatarData = base64;
          const nameVal = modalName ? modalName.value : "Guest";
          updateAvatarView(modalPreview, modalInitials, base64, nameVal);
        });
      });
    }

    if (setUpload) {
      setUpload.addEventListener('change', (e) => {
        handlePhotoUpload(e.target.files[0], (base64) => {
          currentAvatarData = base64;
          const nameVal = setName ? setName.value : "Guest";
          updateAvatarView(setPreview, setInitials, base64, nameVal);
          if (headerAvatar) {
            updateAvatarView(headerAvatar, headerInitials, base64, nameVal);
          }
        });
      });
    }

    if (modalSave) {
      modalSave.addEventListener('click', () => {
        const user = getCurrentUser();
        user.name = modalName ? modalName.value.trim() || user.name : user.name;
        user.avatar = currentAvatarData;
        
        safeStorage.setItem('auth_user', JSON.stringify(user));
        syncAllProfileViews();
        
        if (modal) modal.style.display = 'none';
        alert("Profile updated successfully!");
        logActivity('Profile', `User profile updated to ${user.name}`);
      });
    }

    const settingsSaveBtn = document.getElementById('btn-settings-save');
    if (settingsSaveBtn) {
      settingsSaveBtn.addEventListener('click', () => {
        const user = getCurrentUser();
        user.name = setName ? setName.value.trim() || user.name : user.name;
        user.avatar = currentAvatarData || user.avatar;
        
        safeStorage.setItem('auth_user', JSON.stringify(user));
        if (setNiche) {
          safeStorage.setItem('auth_user_niche', setNiche.value.trim());
        }
        syncAllProfileViews();
        logActivity('Settings', `User profile settings saved for ${user.name}`);
      });
    }

    const settingsResetBtn = document.getElementById('btn-settings-reset');
    if (settingsResetBtn) {
      settingsResetBtn.addEventListener('click', () => {
        setTimeout(() => {
          syncAllProfileViews();
        }, 50);
      });
    }

    document.querySelectorAll('.user-avatar, .profile-select-avatar').forEach(img => {
      img.addEventListener('error', () => {
        const fallbackChar = img.getAttribute('alt') || "U";
        const fallbackDiv = document.createElement('div');
        fallbackDiv.className = img.className;
        fallbackDiv.style.cssText = window.getComputedStyle(img).cssText;
        fallbackDiv.style.background = 'var(--color-primary)';
        fallbackDiv.style.color = '#fff';
        fallbackDiv.style.display = 'flex';
        fallbackDiv.style.alignItems = 'center';
        fallbackDiv.style.justifyContent = 'center';
        fallbackDiv.style.fontWeight = 'bold';
        fallbackDiv.style.fontSize = '0.75rem';
        fallbackDiv.innerText = fallbackChar.charAt(0).toUpperCase();
        if (img.parentNode) {
          img.parentNode.replaceChild(fallbackDiv, img);
        }
      });
    });

    syncAllProfileViews();
  }

  function initFutureAdditions() {
    // -------------------------------------------------------------
    // A. Notification Center Bell & Dropdown Logic
    // -------------------------------------------------------------
    const bellBtn = document.getElementById('btn-notification-bell');
    const badgeEl = document.getElementById('notification-badge');
    const dropdownEl = document.getElementById('notification-dropdown');
    const listEl = document.getElementById('notification-list');
    const clearBtn = document.getElementById('btn-clear-notifications');

    function getNotifications() {
      const saved = safeStorage.getItem('sys_notifications');
      if (saved) {
        try { return JSON.parse(saved); } catch(e) {}
      }
      return [
        { title: "System Ready", text: "Welcome to NexusHub AI Workspace. 6 agents loaded.", timestamp: "17:00:00" },
        { title: "Database Connected", text: "Local database collections initialized and caching checks active.", timestamp: "17:00:05" }
      ];
    }

    function renderNotifications() {
      if (!listEl || !badgeEl) return;
      const list = getNotifications();
      if (list.length === 0) {
        listEl.innerHTML = `
          <div style="text-align: center; color: var(--text-muted); font-size: 0.68rem; padding: 20px 0;">
            No new alerts
          </div>
        `;
        badgeEl.style.display = 'none';
        badgeEl.innerText = '0';
      } else {
        badgeEl.innerText = list.length;
        badgeEl.style.display = 'inline-flex';
        
        let html = '';
        list.forEach(item => {
          html += `
            <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04); padding:8px; border-radius:8px; font-size:0.68rem; display:flex; flex-direction:column; gap:2px; text-align:left;">
              <strong style="color:#fff; font-size:0.72rem;">${item.title}</strong>
              <span style="color:var(--text-secondary);">${item.text}</span>
              <span style="color:var(--text-muted); font-size:0.55rem; margin-top:2px;">${item.timestamp}</span>
            </div>
          `;
        });
        listEl.innerHTML = html;
      }
    }

    window.triggerPushNotification = function(title, text) {
      const list = getNotifications();
      list.unshift({
        title: title,
        text: text,
        timestamp: new Date().toLocaleTimeString()
      });
      safeStorage.setItem('sys_notifications', JSON.stringify(list));
      renderNotifications();
    };

    if (bellBtn) {
      bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dropdownEl) {
          dropdownEl.style.display = dropdownEl.style.display === 'none' ? 'flex' : 'none';
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        safeStorage.setItem('sys_notifications', JSON.stringify([]));
        renderNotifications();
      });
    }

    document.addEventListener('click', () => {
      if (dropdownEl) dropdownEl.style.display = 'none';
    });

    renderNotifications();

    // -------------------------------------------------------------
    // B. Universal RAG Header Search Bar
    // -------------------------------------------------------------
    const searchInput = document.getElementById('header-rag-search');
    const searchSubmitBtn = document.getElementById('btn-header-search-submit');

    function runUniversalSearch() {
      if (!searchInput) return;
      const query = searchInput.value.trim();
      if (!query) return;

      const infoModal = document.getElementById('info-modal-overlay');
      const modalTitle = document.getElementById('modal-title');
      const modalBody = document.getElementById('modal-body-content');
      const modalIcon = document.getElementById('modal-icon');

      if (infoModal && modalTitle && modalBody) {
        if (modalIcon) modalIcon.innerHTML = '<i class="fa-solid fa-circle-nodes" style="color:var(--color-primary);"></i>';
        modalTitle.innerText = 'Semantic RAG Document Search';
        
        modalBody.innerHTML = `
          <h4 style="color:#fff; font-size:0.85rem; margin-bottom:8px;">Search Query: "${query}"</h4>
          <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:10px; border-radius:8px; font-size:0.72rem; color:var(--text-secondary); line-height:1.45; margin-bottom:12px;">
            <strong>Context Citation Matches (Indexed Sources):</strong><br>
            - **API_Doc_2026.pdf (Match 94%):** "The active LLM inference strategy caches RAG pipelines on local databases under 15 minutes timeouts."<br>
            - **Marketing_Brief.docx (Match 82%):** "Integrations router triggers automated social campaign queue sequences."
          </div>
          <p style="font-size:0.75rem; color:#fff; line-height:1.45;"><strong>Semantic Answer:</strong> Based on the indexed company handbook and product documentation, your request regarding <em>"${query}"</em> maps directly to the active system cache whitelist parameters. Model inference completed successfully.</p>
          <button type="button" class="btn-primary" style="margin-top:16px; font-size:0.75rem; padding:8px 16px; width:100%; justify-content:center;" onclick="document.getElementById('info-modal-overlay').classList.remove('open');">Close Search Results</button>
        `;
        infoModal.classList.add('open');
        searchInput.value = '';
        triggerPushNotification("Search Query Submitted", `RAG semantic search completed for: "${query}"`);
      }
    }

    if (searchSubmitBtn) {
      searchSubmitBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        runUniversalSearch();
      });
    }

    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          runUniversalSearch();
        }
      });
    }

    // -------------------------------------------------------------
    // G. CommandCenter Agent Debate Trigger
    // -------------------------------------------------------------
    const debateBtn = document.getElementById('btn-trigger-agent-debate');
    if (debateBtn) {
      debateBtn.addEventListener('click', () => {
        const infoModal = document.getElementById('info-modal-overlay');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body-content');
        const modalIcon = document.getElementById('modal-icon');

        if (infoModal && modalTitle && modalBody) {
          if (modalIcon) modalIcon.innerHTML = '<i class="fa-solid fa-comments" style="color:var(--color-primary);"></i>';
          modalTitle.innerText = 'AI Agent Debate & Layout Audit';
          modalBody.innerHTML = `
            <h4 style="color:#fff; font-size:0.85rem; margin-bottom:8px;">Workspace Review Transcript</h4>
            <div style="background:#09090d; border:1px solid var(--border-color); border-radius:10px; padding:12px; font-family:monospace; font-size:0.68rem; color:#fff; line-height:1.45; height:240px; overflow-y:auto; width:100%; box-shadow:inset 0 0 10px rgba(0,0,0,0.8);">
              <div style="color:#a78bfa; margin-bottom:6px;"><strong>[AGENT ARCHITECT]</strong>: "Reviewing layout specs. Redirected portfolio to stage-landing split grids. Removed showcase dashboard panel. Telemetry lines active."</div>
              <div style="color:#fbbf24; margin-bottom:6px;"><strong>[AGENT AUDIT]</strong>: "Confirmed. Verify Google profile pic loads correctly. Fallback initials check bound. Base64 file loaders mapped."</div>
              <div style="color:#a78bfa; margin-bottom:6px;"><strong>[AGENT ARCHITECT]</strong>: "Adding parallel typewriter benchmarks for Llama/Claude/Mistral. Trigger node physics links."</div>
              <div style="color:#fbbf24; margin-bottom:6px;"><strong>[AGENT AUDIT]</strong>: "Agreed. Telemetry is active. Auto-translation settings synced to settings local storage. Consensus index: 98%."</div>
            </div>
            <button type="button" class="btn-primary" style="margin-top:16px; font-size:0.75rem; padding:8px 16px; width:100%; justify-content:center;" onclick="document.getElementById('info-modal-overlay').classList.remove('open');">Close Audit Log</button>
          `;
          infoModal.classList.add('open');
          triggerPushNotification("Debate Triggered", "Agent Debate Audit completed successfully.");
        }
      });
    }

    // -------------------------------------------------------------
    // H. Speech Translation Selector Change Listener
    // -------------------------------------------------------------
    const translatorLangSel = document.getElementById('settings-translation-lang');
    if (translatorLangSel) {
      translatorLangSel.value = safeStorage.getItem('settings_translation_lang') || 'none';
      translatorLangSel.addEventListener('change', (e) => {
        safeStorage.setItem('settings_translation_lang', e.target.value);
        logActivity('Settings', `Speech Output Translation set to ${e.target.value}`);
      });
    }
  }

  // Load additions
  init3DCyberGlobe('landing-canvas-3d');
  initSineWaveGrid('dashboard-canvas-3d');
  init3DCardTilt();
  initPremiumAdditions();
  initPortfolioShowcase();
  initSettingsExtensions();
  initProfileCustomizer();
  initFutureAdditions();


  // -------------------------------------------------------------
  // 16. Initial State Load check (Google OAuth session restore)
  // -------------------------------------------------------------
  const savedUser = safeStorage.getItem('auth_user');
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      loginUser(user);
    } catch(e) {
      setStage('landing');
    }
  } else {
    setStage('landing');
  }

});
