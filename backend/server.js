import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Config Environment Variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_portfolio';

// Middlewares
app.use(cors());
// Set JSON payload limits to allow Base64 certificate upload sizes
app.use(express.json({ limit: '15mb' }));

// Database Initialization Helper
let db;
async function initializeDB() {
  db = await open({
    filename: join(__dirname, 'database.db'),
    driver: sqlite3.Database
  });

  // Create Tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      password TEXT
    );

    CREATE TABLE IF NOT EXISTS profile (
      id TEXT PRIMARY KEY,
      location TEXT,
      education TEXT,
      email TEXT,
      linkedin TEXT,
      instagram TEXT,
      resumeBase64 TEXT
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT,
      status TEXT,
      statusClass TEXT,
      date TEXT,
      desc TEXT,
      tags TEXT,
      gradientClass TEXT,
      repo TEXT,
      demo TEXT
    );

    CREATE TABLE IF NOT EXISTS certificates (
      id TEXT PRIMARY KEY,
      title TEXT,
      issuer TEXT,
      date TEXT,
      type TEXT,
      image TEXT
    );

    CREATE TABLE IF NOT EXISTS timeline (
      id TEXT PRIMARY KEY,
      date TEXT,
      title TEXT,
      subtitle TEXT,
      content TEXT
    );

    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT,
      percentage INTEGER
    );
  `);

  // Safely add new columns to profile table if they don't exist
  const addProfileColumn = async (columnDef) => {
    try {
      await db.exec(`ALTER TABLE profile ADD COLUMN ${columnDef}`);
    } catch (e) {
      // Column likely already exists
    }
  };

  await addProfileColumn('heroName TEXT');
  await addProfileColumn('heroRole TEXT');
  await addProfileColumn('heroSkillsArray TEXT');
  await addProfileColumn('aboutText1 TEXT');
  await addProfileColumn('aboutText2 TEXT');
  await addProfileColumn('github TEXT');

  const addProjectColumn = async (columnDef) => {
    try {
      await db.exec(`ALTER TABLE projects ADD COLUMN ${columnDef}`);
    } catch (e) {
    }
  };
  await addProjectColumn('imageBase64 TEXT');


  // Setup Admin user if not present
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const hashedPassword = bcrypt.hashSync(adminPassword, 10);
  await db.run(
    'INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)',
    ['admin', hashedPassword]
  );

  // Setup Profile Defaults if empty
  const profileCount = await db.get('SELECT COUNT(*) as count FROM profile');
  if (profileCount.count === 0) {
    await db.run(`
      INSERT INTO profile (id, location, education, email, linkedin, instagram, resumeBase64, heroName, heroRole, heroSkillsArray, aboutText1, aboutText2, github)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'main', 
      'San Francisco, CA', 
      'B.Tech in E&C Engineering', 
      'priyanshu.yadav@example.com', 
      'linkedin.com/in/priyanshu-yadav', 
      '@priyanshu_codes', 
      '', // Blank initial resume
      'Priyanshu Yadav', // heroName
      'Full Stack Developer', // heroRole
      JSON.stringify(['JS', 'React', 'Node', 'CSS']), // heroSkillsArray
      'I am a driven software engineer with a strong foundation in modern web technologies. I love combining technical skills with creative designs to build websites that look fantastic and work flawlessly.', // aboutText1
      "In college, I've actively engaged in academic projects, hackathons, and national coding platforms like Unstop to continually refine my problem-solving ability. I thrive in collaborative environments and enjoy taking on challenging projects.", // aboutText2
      'github.com/priyanshu-codes' // github
    ]);
  } else {
    // Ensure existing rows have the new default values if they are null
    await db.run(`
      UPDATE profile SET 
        heroName = COALESCE(heroName, 'Priyanshu Yadav'),
        heroRole = COALESCE(heroRole, 'Full Stack Developer'),
        heroSkillsArray = COALESCE(heroSkillsArray, '["JS", "React", "Node", "CSS"]'),
        aboutText1 = COALESCE(aboutText1, 'I am a driven software engineer with a strong foundation in modern web technologies. I love combining technical skills with creative designs to build websites that look fantastic and work flawlessly.'),
        aboutText2 = COALESCE(aboutText2, 'In college, I''ve actively engaged in academic projects, hackathons, and national coding platforms like Unstop to continually refine my problem-solving ability. I thrive in collaborative environments and enjoy taking on challenging projects.'),
        github = COALESCE(github, 'github.com/priyanshu-codes')
      WHERE id = 'main'
    `);
  }

  // Setup Skills Defaults if empty
  const skillsCount = await db.get('SELECT COUNT(*) as count FROM skills');
  if (skillsCount.count === 0) {
    const defaultSkills = [
      { id: 'skill-1', name: 'Frontend (HTML/CSS/JS/React)', percentage: 90 },
      { id: 'skill-2', name: 'Backend (NodeJS/Express/SQL)', percentage: 80 },
      { id: 'skill-3', name: 'UI/UX Design & CSS Animations', percentage: 85 },
      { id: 'skill-4', name: 'Data Structures & Algorithms', percentage: 75 }
    ];
    for (const skill of defaultSkills) {
      await db.run(
        'INSERT INTO skills (id, name, percentage) VALUES (?, ?, ?)',
        [skill.id, skill.name, skill.percentage]
      );
    }
  }

  // Setup Projects Defaults if empty
  const projectCount = await db.get('SELECT COUNT(*) as count FROM projects');
  if (projectCount.count === 0) {
    const defaultProjects = [
      {
        id: 'devflow',
        title: "DevFlow Q&A Platform",
        status: "Completed",
        statusClass: "badge-completed",
        date: "May 2024",
        desc: "DevFlow is a developer-centric social platform styled for developers to query, answer, and discuss coding problems. It features a robust reputation system, smart sorting of answers (by score or date), tag-based search, and code block formatting.",
        tags: JSON.stringify(["React", "NodeJS", "Express", "MongoDB", "CSS Glassmorphism"]),
        gradientClass: "gradient-1",
        repo: "https://github.com",
        demo: "#"
      },
      {
        id: 'fintrack',
        title: "FinTrack AI Budgeter",
        status: "Completed",
        statusClass: "badge-completed",
        date: "January 2024",
        desc: "FinTrack is a premium budgeter powered by local heuristics to categorize transaction lists and forecast monthly expenditures. The application maintains all user data client-side for maximum privacy.",
        tags: JSON.stringify(["JS Vanilla", "Chart.js", "LocalDB", "CSS Variables"]),
        gradientClass: "gradient-2",
        repo: "https://github.com",
        demo: "#"
      },
      {
        id: 'auraspace',
        title: "AuraSpace Web3 Social",
        status: "In Progress",
        statusClass: "badge-ongoing",
        date: "Ongoing (Started Nov 2024)",
        desc: "AuraSpace is a decentralized Web3 media container where users hold sovereignty over their contents, connections, and platform data. Integrating smart contracts for micro-tips.",
        tags: JSON.stringify(["Solidity", "Next.js", "IPFS", "Ethers.js"]),
        gradientClass: "gradient-3",
        repo: "https://github.com",
        demo: "#"
      },
      {
        id: 'taskwave',
        title: "TaskWave Workspace",
        status: "In Progress",
        statusClass: "badge-ongoing",
        date: "Ongoing (Started Feb 2025)",
        desc: "TaskWave is a real-time collaborative platform hosting sprint boards, timeline schedules, and instant chat channels. Equipped with WebSocket servers, it handles live updates.",
        tags: JSON.stringify(["HTML/CSS", "WebSockets", "Express", "NodeJS"]),
        gradientClass: "gradient-4",
        repo: "https://github.com",
        demo: "#"
      }
    ];

    for (const proj of defaultProjects) {
      await db.run(`
        INSERT INTO projects (id, title, status, statusClass, date, desc, tags, gradientClass, repo, demo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [proj.id, proj.title, proj.status, proj.statusClass, proj.date, proj.desc, proj.tags, proj.gradientClass, proj.repo, proj.demo]);
    }
  }

  // Setup Timeline Defaults if empty
  const timelineCount = await db.get('SELECT COUNT(*) as count FROM timeline');
  if (timelineCount.count === 0) {
    const defaultTimeline = [
      {
        id: 't-1',
        date: '2024 - Present',
        title: 'Senior Academic Projects Lead',
        subtitle: 'University Computer Science Department',
        content: 'Leading a team of 4 students designing core database systems and frontend services. Mentoring juniors in JavaScript stack architectures and modern CSS layouts.'
      },
      {
        id: 't-2',
        date: '2023 - 2024',
        title: 'Web Developer Intern',
        subtitle: 'Pixel Labs Agency',
        content: 'Developed responsive user interfaces for global clients. Optimized CSS layouts reducing paint and load times by 20%. Integrated REST APIs into single-page web applications.'
      },
      {
        id: 't-3',
        date: 'August 2025 - Present',
        title: 'B.Tech in Electrical and Computer Engineering (E&C)',
        subtitle: 'State Tech University',
        content: 'Focusing on computational architectures, hardware-software integration, digital circuits, and systems programming.'
      }
    ];

    for (const item of defaultTimeline) {
      await db.run(`
        INSERT INTO timeline (id, date, title, subtitle, content)
        VALUES (?, ?, ?, ?, ?)
      `, [item.id, item.date, item.title, item.subtitle, item.content]);
    }
  }

  console.log('Database initialized successfully.');
}

initializeDB().catch(err => {
  console.error('Failed to initialize database:', err);
});

// Authentication Guard Middleware
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. Login Required.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired session. Please log in again.' });
  }
};

/* ==========================================================================
   API Routes
   ========================================================================== */

// Auth Login API
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    // Issue token
    const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '2h' });
    res.json({ token, message: 'Logged in successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Authentication failed.' });
  }
});

// Verify token on application boot
app.get('/api/auth/verify', authenticateAdmin, (req, res) => {
  res.sendStatus(200);
});

// Profile API
app.get('/api/profile', async (req, res) => {
  try {
    const profile = await db.get('SELECT * FROM profile WHERE id = ?', ['main']);
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching profile data.' });
  }
});

app.put('/api/profile', authenticateAdmin, async (req, res) => {
  const { location, education, email, linkedin, instagram, github, resumeBase64, heroName, heroRole, heroSkillsArray, aboutText1, aboutText2 } = req.body;
  try {
    await db.run(`
      UPDATE profile
      SET location = ?, education = ?, email = ?, linkedin = ?, instagram = ?, github = ?, resumeBase64 = ?,
          heroName = ?, heroRole = ?, heroSkillsArray = ?, aboutText1 = ?, aboutText2 = ?
      WHERE id = 'main'
    `, [location, education, email, linkedin, instagram, github, resumeBase64, heroName, heroRole, heroSkillsArray, aboutText1, aboutText2]);
    res.json({ message: 'Profile updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// Skills API
app.get('/api/skills', async (req, res) => {
  try {
    const list = await db.all('SELECT * FROM skills ORDER BY percentage DESC');
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching skills.' });
  }
});

app.post('/api/skills', authenticateAdmin, async (req, res) => {
  const { name, percentage } = req.body;
  const id = 'skill-' + Date.now();
  try {
    await db.run('INSERT INTO skills (id, name, percentage) VALUES (?, ?, ?)', [id, name, percentage]);
    res.status(201).json({ id, message: 'Skill created successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create skill.' });
  }
});

app.delete('/api/skills/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await db.run('DELETE FROM skills WHERE id = ?', [id]);
    res.json({ message: 'Skill deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete skill.' });
  }
});

// Projects API
app.get('/api/projects', async (req, res) => {
  try {
    const list = await db.all('SELECT * FROM projects');
    const parsed = list.map(p => ({
      ...p,
      tags: JSON.parse(p.tags)
    }));
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching projects.' });
  }
});

app.post('/api/projects', authenticateAdmin, async (req, res) => {
  const { title, status, statusClass, date, desc, tags, gradientClass, repo, demo, imageBase64 } = req.body;
  const id = 'proj-' + Date.now();
  try {
    await db.run(`
      INSERT INTO projects (id, title, status, statusClass, date, desc, tags, gradientClass, repo, demo, imageBase64)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, title, status, statusClass, date, desc, JSON.stringify(tags || []), gradientClass, repo, demo, imageBase64 || '']);
    res.status(201).json({ id, message: 'Project created successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create project.' });
  }
});

app.put('/api/projects/:id', authenticateAdmin, async (req, res) => {
  const { title, status, statusClass, date, desc, tags, gradientClass, repo, demo, imageBase64 } = req.body;
  try {
    await db.run(`
      UPDATE projects
      SET title = ?, status = ?, statusClass = ?, date = ?, desc = ?, tags = ?, gradientClass = ?, repo = ?, demo = ?, imageBase64 = ?
      WHERE id = ?
    `, [title, status, statusClass, date, desc, JSON.stringify(tags || []), gradientClass, repo, demo, imageBase64 || '', req.params.id]);
    res.json({ message: 'Project updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update project.' });
  }
});

app.delete('/api/projects/:id', authenticateAdmin, async (req, res) => {
  try {
    await db.run('DELETE FROM projects WHERE id = ?', [req.params.id]);
    res.json({ message: 'Project deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project.' });
  }
});

// Certificates API
app.get('/api/certificates', async (req, res) => {
  try {
    const list = await db.all('SELECT * FROM certificates');
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching certificates.' });
  }
});

app.post('/api/certificates', authenticateAdmin, async (req, res) => {
  const { title, issuer, date, type, image } = req.body;
  const id = 'cert-' + Date.now();
  try {
    await db.run(`
      INSERT INTO certificates (id, title, issuer, date, type, image)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, title, issuer, date, type, image]);
    res.status(201).json({ id, message: 'Certificate created successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save certificate.' });
  }
});

app.delete('/api/certificates/:id', authenticateAdmin, async (req, res) => {
  try {
    await db.run('DELETE FROM certificates WHERE id = ?', [req.params.id]);
    res.json({ message: 'Certificate deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete certificate.' });
  }
});

// Timeline API
app.get('/api/timeline', async (req, res) => {
  try {
    const list = await db.all('SELECT * FROM timeline');
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching timeline.' });
  }
});

app.post('/api/timeline', authenticateAdmin, async (req, res) => {
  const { date, title, subtitle, content } = req.body;
  const id = 'timeline-' + Date.now();
  try {
    await db.run(`
      INSERT INTO timeline (id, date, title, subtitle, content)
      VALUES (?, ?, ?, ?, ?)
    `, [id, date, title, subtitle, content]);
    res.status(201).json({ id, message: 'Timeline item created successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save timeline item.' });
  }
});

app.delete('/api/timeline/:id', authenticateAdmin, async (req, res) => {
  try {
    await db.run('DELETE FROM timeline WHERE id = ?', [req.params.id]);
    res.json({ message: 'Timeline item deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete timeline item.' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Portfolio server running on http://localhost:${PORT}`);
});
