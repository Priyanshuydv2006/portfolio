// Every piece of text on the portfolio lives here.
// The admin panel builds its editor from this list, so adding a field here
// (and a data-c="key" attribute in docs/index.html) makes it editable.
//
// type: text | textarea | url | color | toggle
// hint: optional helper text shown under the field in the admin panel

const f = (group, key, label, type, def, hint = '') => ({ group, key, label, type, default: def, hint });

export const CONTENT_SCHEMA = [
  // ---------------------------------------------------------------- Page
  f('Page & SEO', 'meta.title', 'Browser tab title', 'text', 'Priyanshu Yadav | Embedded & Full-Stack Developer'),
  f('Page & SEO', 'meta.description', 'Search result description', 'textarea', 'Portfolio of Priyanshu Yadav, a B.Tech student in Electronics & Computer Engineering building embedded systems, power electronics and full-stack web apps.'),

  // --------------------------------------------------------------- Theme
  f('Theme', 'theme.accent', 'Accent colour (gold traces, buttons)', 'color', '#D8B45A'),
  f('Theme', 'theme.signal', 'Signal colour (oscilloscope trace)', 'color', '#6FD3FF'),

  // ---------------------------------------------------------- Navigation
  f('Navigation', 'brand.name', 'Logo text', 'text', 'Priyanshu Yadav'),
  f('Navigation', 'nav.home', 'Menu: Home', 'text', 'Home'),
  f('Navigation', 'nav.about', 'Menu: About', 'text', 'About'),
  f('Navigation', 'nav.resume', 'Menu: Journey', 'text', 'Journey'),
  f('Navigation', 'nav.projects', 'Menu: Projects', 'text', 'Projects'),
  f('Navigation', 'nav.certificates', 'Menu: Certificates', 'text', 'Certificates'),
  f('Navigation', 'nav.contact', 'Menu: Contact', 'text', 'Contact'),
  f('Navigation', 'nav.cta', 'Menu button', 'text', 'Hire me'),

  // ---------------------------------------------------------------- Hero
  f('Hero', 'hero.badge.visible', 'Show the availability badge', 'toggle', 'true'),
  f('Hero', 'hero.badge', 'Availability badge text', 'text', 'Open to internships'),
  f('Hero', 'hero.greeting', 'Greeting', 'text', "Hi, I'm"),
  f('Hero', 'hero.name', 'Your name', 'text', 'Priyanshu Yadav'),
  f('Hero', 'hero.headline', 'Headline', 'text', 'I build circuits, firmware and the web apps around them.'),
  f('Hero', 'hero.roles', 'Typing line (separate roles with |)', 'text', 'Embedded developer|Power electronics tinkerer|Full-stack web builder', 'Each role is typed out in turn. Separate them with the | character.'),
  f('Hero', 'hero.description', 'Intro paragraph', 'textarea', "I'm an Electronics & Computer Engineering student who likes projects that blink, switch and ship: ESP32 builds, inverters, battery systems and the Node.js apps that talk to them."),
  f('Hero', 'hero.skills', 'Skill chips (separate with commas)', 'text', 'ESP32, Arduino, Power electronics, Node.js, SQLite'),
  f('Hero', 'hero.cta1', 'Primary button', 'text', 'See my projects'),
  f('Hero', 'hero.cta2', 'Secondary button', 'text', 'Get in touch'),
  f('Hero', 'hero.scope.hint', 'Oscilloscope hint', 'text', 'Move your cursor to tune it. Click to change the waveform.'),
  f('Hero', 'hero.scroll', 'Scroll cue', 'text', 'Scroll'),

  // --------------------------------------------------------------- About
  f('About', 'about.eyebrow', 'Small label above the title', 'text', '01 · Who I am'),
  f('About', 'about.title', 'Section title', 'text', 'About me'),
  f('About', 'about.p1', 'Paragraph 1', 'textarea', "I'm a B.Tech student at Madhav Institute of Technology & Science, Gwalior, studying Electronics & Computer Engineering. I work where hardware meets software."),
  f('About', 'about.p2', 'Paragraph 2', 'textarea', "Alongside coursework I build embedded projects, learn data structures and algorithms, and look for internships where I can ship real things. Startups and entrepreneurship interest me too."),
  f('About', 'about.label.location', 'Label: location', 'text', 'Location'),
  f('About', 'about.location', 'Location', 'text', 'Gwalior, India'),
  f('About', 'about.label.education', 'Label: education', 'text', 'Education'),
  f('About', 'about.education', 'Education', 'text', 'B.Tech, Electronics & Computer Engineering, MITS Gwalior'),
  f('About', 'about.label.email', 'Label: email', 'text', 'Email'),
  f('About', 'about.stack.title', 'Skills heading', 'text', 'What I work with'),

  // -------------------------------------------------------------- Journey
  f('Journey', 'resume.eyebrow', 'Small label above the title', 'text', "02 · Where I've been"),
  f('Journey', 'resume.title', 'Section title', 'text', 'Journey'),
  f('Journey', 'resume.text', 'Resume prompt', 'text', 'Want the full details? Download my resume.'),
  f('Journey', 'resume.button', 'Resume button', 'text', 'Download resume'),

  // ------------------------------------------------------------- Projects
  f('Projects', 'projects.eyebrow', 'Small label above the title', 'text', "03 · What I've built"),
  f('Projects', 'projects.title', 'Section title', 'text', 'Projects'),
  f('Projects', 'projects.filter.all', 'Filter: all', 'text', 'All'),
  f('Projects', 'projects.filter.completed', 'Filter: completed', 'text', 'Completed'),
  f('Projects', 'projects.filter.progress', 'Filter: in progress', 'text', 'In progress'),
  f('Projects', 'projects.empty', 'Message when there are no projects', 'text', 'Projects will show up here soon.'),
  f('Projects', 'projects.card.cta', 'Card link text', 'text', 'View details'),
  f('Projects', 'projects.modal.tech', 'Details: technologies heading', 'text', 'Built with'),
  f('Projects', 'projects.modal.repo', 'Details: source button', 'text', 'Source code'),
  f('Projects', 'projects.modal.demo', 'Details: demo button', 'text', 'Live demo'),

  // --------------------------------------------------------- Certificates
  f('Certificates', 'certificates.eyebrow', 'Small label above the title', 'text', '04 · Proof of work'),
  f('Certificates', 'certificates.title', 'Section title', 'text', 'Certificates'),
  f('Certificates', 'certificates.all', 'Tab: all', 'text', 'All'),
  f('Certificates', 'certificates.empty', 'Message when there are none', 'text', 'Certificates will show up here soon.'),

  // -------------------------------------------------------------- Contact
  f('Contact', 'contact.eyebrow', 'Small label above the title', 'text', '05 · Say hello'),
  f('Contact', 'contact.title', 'Section title', 'text', 'Contact'),
  f('Contact', 'contact.heading', 'Heading', 'text', "Let's build something"),
  f('Contact', 'contact.text', 'Intro text', 'textarea', "Looking for an intern, a collaborator or someone to prototype an idea with? Send a message and I'll get back to you."),
  f('Contact', 'contact.email', 'Your email address', 'text', '', 'Leave empty to hide the email card.'),
  f('Contact', 'contact.linkedin', 'LinkedIn URL', 'url', '', 'Leave empty to hide.'),
  f('Contact', 'contact.instagram', 'Instagram URL', 'url', '', 'Leave empty to hide.'),
  f('Contact', 'contact.github', 'GitHub URL', 'url', '', 'Leave empty to hide.'),
  f('Contact', 'contact.card.email', 'Card label: email', 'text', 'Email'),
  f('Contact', 'contact.card.linkedin', 'Card label: LinkedIn', 'text', 'LinkedIn'),
  f('Contact', 'contact.card.instagram', 'Card label: Instagram', 'text', 'Instagram'),
  f('Contact', 'contact.card.github', 'Card label: GitHub', 'text', 'GitHub'),
  f('Contact', 'contact.form.name', 'Form: name label', 'text', 'Your name'),
  f('Contact', 'contact.form.email', 'Form: email label', 'text', 'Your email'),
  f('Contact', 'contact.form.message', 'Form: message label', 'text', 'Message'),
  f('Contact', 'contact.form.placeholder', 'Form: message placeholder', 'text', 'What are you working on?'),
  f('Contact', 'contact.form.name.ph', 'Form: name placeholder', 'text', 'Ada Lovelace'),
  f('Contact', 'contact.form.email.ph', 'Form: email placeholder', 'text', 'you@example.com'),
  f('Contact', 'contact.form.button', 'Form: send button', 'text', 'Send message'),
  f('Contact', 'contact.form.sending', 'Form: sending text', 'text', 'Sending...'),
  f('Contact', 'contact.form.success', 'Form: success message', 'text', "Message sent. I'll reply to your email soon."),
  f('Contact', 'contact.form.error', 'Form: error message', 'text', "Couldn't send your message. Try again, or email me directly."),

  // --------------------------------------------------------------- Footer
  f('Footer', 'footer.text', 'Footer text', 'text', '© {year} Priyanshu Yadav. All rights reserved.', '{year} becomes the current year.'),
  f('Footer', 'footer.top', 'Back to top link', 'text', 'Back to top'),

  // ------------------------------------------------------ System messages
  f('System messages', 'ui.waking', 'Shown while the server wakes up', 'text', 'Waking up the server. The first visit can take a few seconds.'),
  f('System messages', 'ui.offline', 'Shown when the server cannot be reached', 'text', "Can't reach the server right now."),
  f('System messages', 'ui.retry', 'Retry button', 'text', 'Try again'),

  // ---------------------------------------------------- Section visibility
  f('Show or hide sections', 'section.about.visible', 'Show About', 'toggle', 'true'),
  f('Show or hide sections', 'section.resume.visible', 'Show Journey', 'toggle', 'true'),
  f('Show or hide sections', 'section.projects.visible', 'Show Projects', 'toggle', 'true'),
  f('Show or hide sections', 'section.certificates.visible', 'Show Certificates', 'toggle', 'true'),
  f('Show or hide sections', 'section.contact.visible', 'Show Contact', 'toggle', 'true'),
];

export const CONTENT_DEFAULTS = Object.fromEntries(CONTENT_SCHEMA.map((x) => [x.key, x.default]));
export const CONTENT_BY_KEY = Object.fromEntries(CONTENT_SCHEMA.map((x) => [x.key, x]));
