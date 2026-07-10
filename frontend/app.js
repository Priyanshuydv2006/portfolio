/* ==========================================================================
   Portfolio Dynamic Logic & Backend Integration
   ========================================================================== */

const API_BASE = 'https://portfolio-1-fhwz.onrender.com/api';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  lucide.createIcons();

  // App State Data
  let projectsData = [];
  let certificatesData = [];
  let timelineData = [];
  let profileData = {};
  
  let activeCertTab = 'college';
  let uploadedFileBase64 = ''; // Base64 uploader cache

  /* ==========================================================================
     Core API Fetch Handlers
     ========================================================================== */

  // Fetch Profile Details
  async function fetchProfile() {
    try {
      const res = await fetch(`${API_BASE}/profile`);
      profileData = await res.json();
      
      // Update DOM with Profile Data
      document.getElementById('profileLocation').innerText = profileData.location;
      document.getElementById('profileEducation').innerText = profileData.education;
      document.getElementById('profileEmail').innerText = profileData.email;
      
      // Update Hero Code Block
      document.getElementById('heroCodeName').innerText = `'${profileData.heroName}'`;
      document.getElementById('heroCodeRole').innerText = `'${profileData.heroRole}'`;
      const skillsArray = JSON.parse(profileData.heroSkillsArray || '[]');
      document.getElementById('heroCodeSkills').innerHTML = `[${skillsArray.map(s => `<span class="code-string">'${s}'</span>`).join(', ')}]`;
      
      // Update About Text
      document.getElementById('aboutText1').innerText = profileData.aboutText1;
      document.getElementById('aboutText2').innerText = profileData.aboutText2;
      
      // Contact Details Grid
      document.getElementById('contactEmailLabel').innerText = profileData.email;
      document.getElementById('contactMailCard').setAttribute('href', `mailto:${profileData.email}`);
      
      document.getElementById('contactLinkedinLabel').innerText = profileData.linkedin.replace('https://', '').replace('www.', '');
      document.getElementById('contactLinkedinCard').setAttribute('href', profileData.linkedin);
      
      document.getElementById('contactIgLabel').innerText = profileData.instagram.replace('https://', '').replace('www.', '');
      document.getElementById('contactIgCard').setAttribute('href', profileData.instagram);

      // Prepopulate Admin Form fields if logged in
      if (isAdminLoggedIn()) {
        document.getElementById('adminLocation').value = profileData.location;
        document.getElementById('adminEducation').value = profileData.education;
        document.getElementById('adminEmail').value = profileData.email;
        document.getElementById('adminLinkedin').value = profileData.linkedin;
        document.getElementById('adminInstagram').value = profileData.instagram;
        document.getElementById('adminHeroName').value = profileData.heroName || '';
        document.getElementById('adminHeroRole').value = profileData.heroRole || '';
        document.getElementById('adminHeroSkills').value = skillsArray.join(', ');
        document.getElementById('adminAboutText1').value = profileData.aboutText1 || '';
        document.getElementById('adminAboutText2').value = profileData.aboutText2 || '';
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  }

  // Fetch Skills
  let skillsData = [];
  async function fetchSkills() {
    try {
      const res = await fetch(`${API_BASE}/skills`);
      skillsData = await res.json();
      renderSkillsGrid();
      if (isAdminLoggedIn()) renderAdminSkillsList();
    } catch (err) {
      console.error('Error loading skills:', err);
    }
  }

  // Fetch Projects List
  async function fetchProjects() {
    try {
      const res = await fetch(`${API_BASE}/projects`);
      projectsData = await res.json();
      renderProjectsGrid();
      if (isAdminLoggedIn()) renderAdminProjectsList();
    } catch (err) {
      console.error('Error loading projects:', err);
    }
  }

  // Fetch Certificates List
  async function fetchCertificates() {
    try {
      const res = await fetch(`${API_BASE}/certificates`);
      certificatesData = await res.json();
      renderCertificatesGrid();
      if (isAdminLoggedIn()) renderAdminCertsList();
    } catch (err) {
      console.error('Error loading certificates:', err);
    }
  }

  // Fetch Timeline Items
  async function fetchTimeline() {
    try {
      const res = await fetch(`${API_BASE}/timeline`);
      timelineData = await res.json();
      renderTimeline();
      if (isAdminLoggedIn()) renderAdminTimelineList();
    } catch (err) {
      console.error('Error loading timeline:', err);
    }
  }

  // Initialize Data Load
  async function loadAllContent() {
    await fetchProfile();
    await fetchSkills();
    await fetchProjects();
    await fetchCertificates();
    await fetchTimeline();
    checkAuthStatus();
  }
  
  loadAllContent();

  /* ==========================================================================
     Frontend Rendering Engines
     ========================================================================== */

  // Render Skills List
  function renderSkillsGrid() {
    const container = document.getElementById('skillsListContainer');
    if (!container) return;
    container.innerHTML = '';
    
    if (skillsData.length === 0) {
      container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px 0; width: 100%;">No skills added yet.</div>';
      return;
    }
    
    skillsData.forEach(skill => {
      const item = document.createElement('div');
      item.className = 'skill-item';
      item.innerHTML = `
        <div class="skill-info">
          <span>${skill.name}</span>
          <span>${skill.percentage}%</span>
        </div>
        <div class="skill-bar-bg">
          <div class="skill-bar-fill" style="width: ${skill.percentage}%;"></div>
        </div>
      `;
      container.appendChild(item);
    });
  }

  // Render Projects Grid
  function renderProjectsGrid() {
    const grid = document.getElementById('projectsGrid');
    grid.innerHTML = '';

    if (projectsData.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:var(--text-muted);">No projects found. Add them from the admin panel!</div>';
      return;
    }

    projectsData.forEach(project => {
      const card = document.createElement('div');
      card.className = 'project-card scroll-reveal revealed';
      card.setAttribute('data-category', project.status.toLowerCase() === 'completed' ? 'completed' : 'ongoing');
      
      // Select appropriate icon
      let iconName = 'globe';
      if (project.gradientClass === 'gradient-1') iconName = 'message-square';
      if (project.gradientClass === 'gradient-2') iconName = 'trending-up';
      if (project.gradientClass === 'gradient-4') iconName = 'sliders';

      card.innerHTML = `
        <div class="project-image-placeholder ${project.gradientClass}">
          <i data-lucide="${iconName}" class="project-icon"></i>
        </div>
        <div class="project-content">
          <span class="project-status ${project.statusClass}">${project.status}</span>
          <h3 class="project-title">${project.title}</h3>
          <p class="project-summary">${project.desc}</p>
          <div class="project-tags">
            ${project.tags.map(t => `<span>${t}</span>`).join('')}
          </div>
          <button class="btn-text open-project-details" data-project-id="${project.id}">
            <span>View Details</span>
            <i data-lucide="arrow-right"></i>
          </button>
        </div>
      `;

      // Detail button hook
      card.querySelector('.open-project-details').addEventListener('click', () => {
        openProjectModal(project, iconName);
      });

      grid.appendChild(card);
    });

    lucide.createIcons();
  }

  // Render Certificates Grid
  function renderCertificatesGrid() {
    const grid = document.getElementById('certsDisplayGrid');
    grid.innerHTML = '';

    const filtered = certificatesData.filter(c => c.type === activeCertTab);

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 180px; text-align: center; color: var(--text-muted);">
          <i data-lucide="award" style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;"></i>
          <p>No credentials uploaded in this category.</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    filtered.forEach(cert => {
      const card = document.createElement('div');
      card.className = 'cert-card';
      card.innerHTML = `
        <div class="cert-image">
          <img src="${cert.image}" alt="${cert.title}">
          <div class="cert-card-overlay">
            <div class="cert-zoom-icon">
              <i data-lucide="maximize-2" style="width: 20px; height: 20px; color: white;"></i>
            </div>
          </div>
        </div>
        <div class="cert-details">
          <h4>${cert.title}</h4>
          <div class="cert-meta">
            <span>${cert.issuer}</span>
            <span>${formatMonth(cert.date)}</span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => openLightbox(cert));
      grid.appendChild(card);
    });

    lucide.createIcons();
  }

  // Render Timeline
  function renderTimeline() {
    const container = document.getElementById('timelineContainer');
    container.innerHTML = '';

    if (timelineData.length === 0) {
      container.innerHTML = '<div style="text-align:center; color:var(--text-muted); width:100%;">No timeline items configured.</div>';
      return;
    }

    // Sort timeline items (roughly chronologically or by ID order, custom sorting can be configured)
    timelineData.forEach(item => {
      const timelineItem = document.createElement('div');
      timelineItem.className = 'timeline-item scroll-reveal revealed';
      timelineItem.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-date">${item.date}</div>
        <div class="timeline-content">
          <h3>${item.title}</h3>
          <h4>${item.subtitle}</h4>
          <p>${item.content}</p>
        </div>
      `;
      container.appendChild(timelineItem);
    });
  }

  /* ==========================================================================
     Admin Security state and Lock screen Manager
     ========================================================================== */
  /* ==========================================================================
     Admin Security state and Lock screen Manager
     ========================================================================== */

  function isAdminLoggedIn() {
    return localStorage.getItem('portfolio_token') !== null;
  }

  function getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('portfolio_token')}`
    };
  }

  // Toggle page states based on login
  function checkAuthStatus() {
    const loginLink = document.getElementById('btnAdminPortalLink');

    if (isAdminLoggedIn()) {
      // Authenticated state
      loginLink.innerHTML = '<i data-lucide="unlock" style="width:12px; height:12px; display:inline-block; vertical-align:middle;"></i> Admin Settings';
    } else {
      // Guest state
      loginLink.innerHTML = '<i data-lucide="lock" style="width:12px; height:12px; display:inline-block; vertical-align:middle;"></i> Admin Panel';
    }

    lucide.createIcons();
  }

  /* ==========================================================================
     Admin Dialog & Panel triggers
     ========================================================================== */
  const adminLoginModal = document.getElementById('adminLoginModal');
  const adminDashboardModal = document.getElementById('adminDashboardModal');
  
  const btnAdminPortalLink = document.getElementById('btnAdminPortalLink');
  const btnCloseAdminLogin = document.getElementById('btnCloseAdminLogin');
  const btnCloseAdminDashboard = document.getElementById('btnCloseAdminDashboard');
  
  const adminLoginForm = document.getElementById('adminLoginForm');
  const btnAdminLogout = document.getElementById('btnAdminLogout');

  // Trigger login modal or directly open dashboard if already logged in
  btnAdminPortalLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (isAdminLoggedIn()) {
      openAdminDashboard();
    } else {
      adminLoginModal.classList.remove('hide');
    }
  });

  btnCloseAdminLogin.addEventListener('click', () => adminLoginModal.classList.add('hide'));
  btnCloseAdminDashboard.addEventListener('click', () => {
    adminDashboardModal.classList.add('hide');
    document.body.style.overflow = '';
  });

  // Handle Login Request
  adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Login failed.');
        return;
      }

      localStorage.setItem('portfolio_token', data.token);
      adminLoginForm.reset();
      adminLoginModal.classList.add('hide');
      
      // Fetch data sets to populate lists and open Dashboard
      loadAllContent();
      openAdminDashboard();
    } catch (err) {
      console.error(err);
      alert('Failed to connect to backend server.');
    }
  });

  // Handle Logout Request
  btnAdminLogout.addEventListener('click', () => {
    localStorage.removeItem('portfolio_token');
    adminDashboardModal.classList.add('hide');
    document.body.style.overflow = '';
    loadAllContent();
    alert('Logged out successfully.');
  });

  /* ==========================================================================
     Admin Panel Dashboard Tabs
     ========================================================================== */
  const adminTabBtns = adminDashboardModal.querySelectorAll('[data-admin-tab]');
  const adminPanelDivs = adminDashboardModal.querySelectorAll('.admin-panel-div');

  adminTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      adminTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetTab = btn.getAttribute('data-admin-tab');
      adminPanelDivs.forEach(panel => {
        if (panel.getAttribute('id') === `adminPanel-${targetTab}`) {
          panel.classList.remove('hide');
        } else {
          panel.classList.add('hide');
        }
      });
    });
  });

  function openAdminDashboard() {
    adminDashboardModal.classList.remove('hide');
    document.body.style.overflow = 'hidden';
    
    // Pre-populate Profile fields
    document.getElementById('adminLocation').value = profileData.location || '';
    document.getElementById('adminEducation').value = profileData.education || '';
    document.getElementById('adminEmail').value = profileData.email || '';
    document.getElementById('adminLinkedin').value = profileData.linkedin || '';
    document.getElementById('adminInstagram').value = profileData.instagram || '';
    
    // Render Admin Management lists
    renderAdminProjectsList();
    renderAdminCertsList();
    renderAdminTimelineList();
    
    lucide.createIcons();
  }

  /* ==========================================================================
     Admin CRUD List Renderers
     ========================================================================== */

  // Render projects manage list
  function renderAdminProjectsList() {
    const list = document.getElementById('adminProjectsList');
    list.innerHTML = '';

    projectsData.forEach(p => {
      const row = document.createElement('div');
      row.className = 'admin-item-row';
      row.innerHTML = `
        <div class="admin-item-details">
          <span class="admin-item-title">${p.title}</span>
          <span class="admin-item-subtitle">${p.date} • ${p.status}</span>
        </div>
        <button class="btn-delete-item" data-delete-project-id="${p.id}">
          <i data-lucide="trash-2" style="width:14px; height:14px;"></i> Delete
        </button>
      `;

      row.querySelector('.btn-delete-item').addEventListener('click', () => deleteProject(p.id));
      list.appendChild(row);
    });
    lucide.createIcons();
  }

  // Render certs manage list
  function renderAdminCertsList() {
    const list = document.getElementById('adminCertsList');
    list.innerHTML = '';

    certificatesData.forEach(c => {
      const row = document.createElement('div');
      row.className = 'admin-item-row';
      row.innerHTML = `
        <div class="admin-item-details">
          <span class="admin-item-title">${c.title}</span>
          <span class="admin-item-subtitle">${c.issuer} • ${c.type.toUpperCase()}</span>
        </div>
        <button class="btn-delete-item" data-delete-cert-id="${c.id}">
          <i data-lucide="trash-2" style="width:14px; height:14px;"></i> Delete
        </button>
      `;

      row.querySelector('.btn-delete-item').addEventListener('click', () => deleteCertificate(c.id));
      list.appendChild(row);
    });
    lucide.createIcons();
  }

  // Render timeline manage list
  function renderAdminTimelineList() {
    const list = document.getElementById('adminTimelineList');
    list.innerHTML = '';

    timelineData.forEach(t => {
      const row = document.createElement('div');
      row.className = 'admin-item-row';
      row.innerHTML = `
        <div class="admin-item-details">
          <span class="admin-item-title">${t.title}</span>
          <span class="admin-item-subtitle">${t.subtitle} • ${t.date}</span>
        </div>
        <button class="btn-delete-item" data-delete-timeline-id="${t.id}">
          <i data-lucide="trash-2" style="width:14px; height:14px;"></i> Delete
        </button>
      `;

      row.querySelector('.btn-delete-item').addEventListener('click', () => deleteTimelineItem(t.id));
      list.appendChild(row);
    });
    lucide.createIcons();
  }

  /* ==========================================================================
     Admin CRUD API Call Submissions
     ========================================================================== */

  // Update Profile Form
  const adminProfileForm = document.getElementById('adminProfileForm');
  adminProfileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const location = document.getElementById('adminLocation').value;
    const education = document.getElementById('adminEducation').value;
    const email = document.getElementById('adminEmail').value;
    const linkedin = document.getElementById('adminLinkedin').value;
    const instagram = document.getElementById('adminInstagram').value;
    const heroName = document.getElementById('adminHeroName').value;
    const heroRole = document.getElementById('adminHeroRole').value;
    const heroSkillsInput = document.getElementById('adminHeroSkills').value;
    const aboutText1 = document.getElementById('adminAboutText1').value;
    const aboutText2 = document.getElementById('adminAboutText2').value;
    const resumeFileInput = document.getElementById('resumeFileInput');

    const heroSkillsArray = JSON.stringify(heroSkillsInput.split(',').map(s => s.trim()).filter(s => s));

    // Prepare payload. Check if a new resume file is caching
    let resumeBase64 = profileData.resumeBase64 || '';
    if (uploadedFileBase64 && resumeFileInput.files.length) {
      resumeBase64 = uploadedFileBase64;
    }

    try {
      const res = await fetch(`${API_BASE}/profile`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ location, education, email, linkedin, instagram, resumeBase64, heroName, heroRole, heroSkillsArray, aboutText1, aboutText2 })
      });

      if (res.ok) {
        alert('Profile configured successfully!');
        uploadedFileBase64 = ''; // Clear uploader cache
        document.getElementById('resumeFileLabel').innerText = 'Select PDF file or image';
        fetchProfile();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update profile.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating profile settings.');
    }
  });

  // Handle Resume Dropzone File
  const resumeFileInput = document.getElementById('resumeFileInput');
  const resumeDropzone = document.getElementById('resumeDropzone');
  const resumeFileLabel = document.getElementById('resumeFileLabel');

  resumeFileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
      const file = e.target.files[0];
      resumeFileLabel.innerText = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        uploadedFileBase64 = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  // Add Project Form
  const adminProjectForm = document.getElementById('adminProjectForm');
  adminProjectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('projTitle').value;
    const date = document.getElementById('projDate').value;
    const status = document.getElementById('projStatus').value;
    const gradientClass = document.getElementById('projGradient').value;
    const desc = document.getElementById('projDesc').value;
    const tagsInput = document.getElementById('projTags').value;
    const repo = document.getElementById('projRepo').value;
    const demo = document.getElementById('projDemo').value;

    const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t !== '');
    const statusClass = status === 'Completed' ? 'badge-completed' : 'badge-ongoing';

    try {
      const res = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ title, date, status, statusClass, gradientClass, desc, tags, repo, demo })
      });

      if (res.ok) {
        alert('Project added successfully!');
        adminProjectForm.reset();
        fetchProjects();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add project.');
      }
    } catch (err) {
      console.error(err);
      alert('Error adding project.');
    }
  });

  // Delete Project API
  async function deleteProject(id) {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      const res = await fetch(`${API_BASE}/projects/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        fetchProjects();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete project.');
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Manage Skills API (Admin Modal Panel)
  const adminSkillForm = document.getElementById('adminSkillForm');
  
  function renderAdminSkillsList() {
    const list = document.getElementById('adminSkillsList');
    if (!list) return;
    list.innerHTML = '';
    skillsData.forEach(skill => {
      const row = document.createElement('div');
      row.className = 'admin-list-item';
      row.innerHTML = `
        <div class="info">
          <strong>${skill.name}</strong> 
          <span style="font-size: 0.8rem; color: var(--text-muted);">(${skill.percentage}%)</span>
        </div>
        <button class="btn-delete" data-id="${skill.id}" title="Delete Skill"><i data-lucide="trash-2"></i></button>
      `;
      list.appendChild(row);
    });
    lucide.createIcons();
  }

  if (adminSkillForm) {
    adminSkillForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('skillName').value;
      const percentage = document.getElementById('skillPercentage').value;

      try {
        const res = await fetch(`${API_BASE}/skills`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ name, percentage: parseInt(percentage, 10) })
        });
        if (res.ok) {
          adminSkillForm.reset();
          fetchSkills();
        } else {
          const err = await res.json();
          alert(err.error || 'Failed to create skill.');
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  document.getElementById('adminDashboardModal').addEventListener('click', async (e) => {
    // Only capture delete buttons in the skills list
    const btn = e.target.closest('#adminSkillsList .btn-delete');
    if (!btn) return;
    
    if (!confirm('Delete this skill?')) return;
    const id = btn.getAttribute('data-id');
    try {
      const res = await fetch(`${API_BASE}/skills/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        fetchSkills();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete skill.');
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Add Certificate API (Admin Modal Panel)
  const adminCertForm = document.getElementById('adminCertForm');
  const adminCertFileInput = document.getElementById('adminCertFileInput');
  const adminCertDropzonePreview = document.getElementById('adminCertDropzonePreview');
  const adminCertPreviewImage = document.getElementById('adminCertPreviewImage');
  const adminCertDropzoneContent = document.getElementById('adminCertDropzoneContent');

  adminCertFileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        uploadedFileBase64 = event.target.result;
        adminCertPreviewImage.src = uploadedFileBase64;
        adminCertDropzoneContent.classList.add('hide');
        adminCertDropzonePreview.classList.remove('hide');
      };
      reader.readAsDataURL(file);
    }
  });

  adminCertForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('adminCertTitle').value;
    const issuer = document.getElementById('adminCertIssuer').value;
    const date = document.getElementById('adminCertDate').value;
    const type = document.getElementById('adminCertType').value;

    if (!uploadedFileBase64) {
      alert('Please upload a certificate image.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/certificates`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ title, issuer, date, type, image: uploadedFileBase64 })
      });

      if (res.ok) {
        alert('Certificate uploaded to database!');
        adminCertForm.reset();
        uploadedFileBase64 = '';
        adminCertPreviewImage.src = '';
        adminCertDropzoneContent.classList.remove('hide');
        adminCertDropzonePreview.classList.add('hide');
        fetchCertificates();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add certificate.');
      }
    } catch (err) {
      console.error(err);
      alert('Error uploading certificate.');
    }
  });

  // Delete Certificate API
  async function deleteCertificate(id) {
    if (!confirm('Are you sure you want to delete this credential?')) return;
    try {
      const res = await fetch(`${API_BASE}/certificates/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        fetchCertificates();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete certificate.');
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Add Career Timeline Item Form
  const adminTimelineForm = document.getElementById('adminTimelineForm');
  adminTimelineForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('timeTitle').value;
    const date = document.getElementById('timeDate').value;
    const subtitle = document.getElementById('timeSubtitle').value;
    const content = document.getElementById('timeContent').value;

    try {
      const res = await fetch(`${API_BASE}/timeline`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ title, date, subtitle, content })
      });

      if (res.ok) {
        alert('Timeline card added!');
        adminTimelineForm.reset();
        fetchTimeline();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add timeline card.');
      }
    } catch (err) {
      console.error(err);
      alert('Error adding timeline card.');
    }
  });

  // Delete Timeline Item API
  async function deleteTimelineItem(id) {
    if (!confirm('Are you sure you want to delete this timeline item?')) return;
    try {
      const res = await fetch(`${API_BASE}/timeline/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        fetchTimeline();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete timeline item.');
      }
    } catch (err) {
      console.error(err);
    }
  }


  /* ==========================================================================
     Navbar & Scroll Reveals & Navigation Control
     ========================================================================== */
  const navbar = document.querySelector('.navbar');
  const navMenu = document.getElementById('navMenu');
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section');

  // Change Navbar layout on scroll
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scroll-scrolled');
    } else {
      navbar.classList.remove('scroll-scrolled');
    }
    highlightNavigation();
  });

  // Mobile menu toggle
  navToggle.addEventListener('click', () => {
    navMenu.classList.toggle('show');
    const icon = navToggle.querySelector('i');
    if (navMenu.classList.contains('show')) {
      icon.setAttribute('data-lucide', 'x');
    } else {
      icon.setAttribute('data-lucide', 'menu');
    }
    lucide.createIcons();
  });

  // Close Mobile menu when a link is clicked
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('show');
      const icon = navToggle.querySelector('i');
      icon.setAttribute('data-lucide', 'menu');
      lucide.createIcons();
    });
  });

  // Highlight navigation links corresponding to the visible section
  function highlightNavigation() {
    let currentSection = '';
    const scrollPos = window.scrollY + 120; // Offset for navbar

    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
        currentSection = section.getAttribute('id');
      }
    });

    if (currentSection) {
      navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${currentSection}`) {
          link.classList.add('active');
        }
      });
    }
  }

  // Tab trigger handlers for Certificates UI
  const certTabButtons = document.querySelectorAll('.cert-tab-btn');
  certTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      certTabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCertTab = btn.getAttribute('data-tab');
      renderCertificatesGrid();
    });
  });

  // Dynamic Month Formatting
  function formatMonth(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 2) return dateStr;
    const [year, month] = parts;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const idx = parseInt(month, 10) - 1;
    return `${months[idx]} ${year}`;
  }

  // Reveal Observer for on-scroll animations
  const revealElements = document.querySelectorAll('.scroll-reveal');
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        // trigger progress width animations on skill fillbars
        if (entry.target.classList.contains('skills-wrapper')) {
          const bars = entry.target.querySelectorAll('.skill-bar-fill');
          bars.forEach(bar => bar.style.transform = 'scaleX(1)');
        }
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

  revealElements.forEach(el => revealObserver.observe(el));

  // Projects Filters
  const filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.getAttribute('data-filter');
      const projectCards = document.querySelectorAll('.project-card');

      projectCards.forEach(card => {
        const category = card.getAttribute('data-category');
        if (filter === 'all' || category === filter) {
          card.classList.remove('hide');
          card.style.opacity = '0';
          setTimeout(() => {
            card.style.opacity = '1';
            card.style.transition = 'opacity 0.4s ease';
          }, 10);
        } else {
          card.classList.add('hide');
        }
      });
    });
  });

  /* ==========================================================================
     Dynamic Detail Modals & Lightbox Overlays
     ========================================================================== */
  const projectModal = document.getElementById('projectModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const modalTitle = document.getElementById('modalProjectTitle');
  const modalImg = document.getElementById('modalProjectImg');
  const modalStatus = document.getElementById('modalProjectStatus');
  const modalDate = document.getElementById('modalProjectDate');
  const modalDesc = document.getElementById('modalProjectDesc');
  const modalTags = document.getElementById('modalProjectTags');
  const modalRepo = document.getElementById('modalRepoLink');
  const modalDemo = document.getElementById('modalDemoLink');

  function openProjectModal(project, iconName) {
    modalTitle.innerText = project.title;
    modalImg.className = 'modal-image-placeholder ' + project.gradientClass;
    modalImg.innerHTML = `<i data-lucide="${iconName}" style="width:64px; height:64px; color:white;"></i>`;
    modalStatus.innerText = project.status;
    modalStatus.className = 'project-status ' + project.statusClass;
    modalDate.innerText = project.date;
    modalDesc.innerText = project.desc;
    
    modalTags.innerHTML = '';
    project.tags.forEach(t => {
      const span = document.createElement('span');
      span.innerText = t;
      modalTags.appendChild(span);
    });

    modalRepo.setAttribute('href', project.repo);
    modalDemo.setAttribute('href', project.demo);

    projectModal.classList.remove('hide');
    document.body.style.overflow = 'hidden';
    lucide.createIcons();
  }

  function closeProjectModal() {
    projectModal.classList.add('hide');
    document.body.style.overflow = '';
  }

  btnCloseModal.addEventListener('click', closeProjectModal);
  projectModal.addEventListener('click', (e) => {
    if (e.target === projectModal) closeProjectModal();
  });

  // Lightbox Modal
  const lightboxModal = document.getElementById('lightboxModal');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxTitle = document.getElementById('lightboxTitle');
  const lightboxMeta = document.getElementById('lightboxMeta');
  const btnCloseLightbox = document.getElementById('btnCloseLightbox');
  const lightboxOverlay = document.getElementById('lightboxOverlay');

  function openLightbox(cert) {
    lightboxImg.src = cert.image;
    lightboxTitle.innerText = cert.title;
    lightboxMeta.innerText = `${cert.issuer} • ${formatMonth(cert.date)}`;
    lightboxModal.classList.remove('hide');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightboxModal.classList.add('hide');
    document.body.style.overflow = '';
  }

  btnCloseLightbox.addEventListener('click', closeLightbox);
  lightboxOverlay.addEventListener('click', closeLightbox);

  // Resume Download Handler
  const downloadResumeBtn = document.getElementById('downloadResume');
  downloadResumeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (profileData.resumeBase64) {
      // Create download trigger for the stored file
      const link = document.createElement('a');
      link.href = profileData.resumeBase64;
      const isPdf = profileData.resumeBase64.startsWith('data:application/pdf');
      link.download = isPdf ? 'Priyanshu_Yadav_Resume.pdf' : 'Priyanshu_Yadav_Resume.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Fallback: draw mockup resume preview
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 800;
      const ctx = canvas.getContext('2d');
      
      ctx.fillStyle = '#08070d';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px "Outfit", sans-serif';
      ctx.fillText(`${profileData.username || 'Priyanshu Yadav'} - Resume`, 50, 80);
      
      ctx.fillStyle = '#8b5cf6';
      ctx.fillRect(50, 100, 500, 3);
      
      ctx.fillStyle = '#9ca3af';
      ctx.font = '16px "Inter", sans-serif';
      ctx.fillText(`Contact: ${profileData.email || 'priyanshu.yadav@example.com'}`, 50, 130);
      ctx.fillText(`Education: ${profileData.education || 'B.Tech in E&C Engineering'}`, 50, 160);
      
      ctx.fillStyle = '#ffffff';
      ctx.fillText('This document simulates Priyanshu Yadav\'s formal resume.', 50, 250);
      ctx.fillText('Please log into the Admin Panel to upload your real PDF!', 50, 280);

      const dlLink = document.createElement('a');
      dlLink.href = canvas.toDataURL('image/png');
      dlLink.download = 'Priyanshu_Yadav_Resume_Preview.png';
      document.body.appendChild(dlLink);
      dlLink.click();
      document.body.removeChild(dlLink);
    }
  });

  // Mock Contact Form
  const contactForm = document.getElementById('contactForm');
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('contactName').value;
    const email = document.getElementById('contactEmail').value;
    alert(`Thank you, ${name}! Your message was simulated successfully. Real backend messaging can be configured. I will write back at ${email}.`);
    contactForm.reset();
  });
});
