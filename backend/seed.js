// First-run content. Everything here can be edited or deleted from the admin panel.
// Only facts Priyanshu has stated are used. Project statuses and dates are best
// guesses: fix them in the admin panel.

// Contact links come from the old portfolio database that was committed to the repo.
export const SEED_CONTENT = {
  'contact.email': 'liveinsaan2021@gmail.com',
  'contact.linkedin': 'https://linkedin.com/in/priyanshu-yadav',
  'contact.instagram': 'https://instagram.com/priyanshu_ydv110',
};

export const SEED_SKILLS = [
  { name: 'ESP32', category: 'Embedded' },
  { name: 'Arduino', category: 'Embedded' },
  { name: 'C / C++', category: 'Embedded' },
  { name: 'ROS2', category: 'Embedded' },
  { name: 'Power electronics', category: 'Hardware' },
  { name: 'Circuit design', category: 'Hardware' },
  { name: 'Python', category: 'Software' },
  { name: 'Data structures & algorithms', category: 'Software' },
  { name: 'Node.js', category: 'Web' },
  { name: 'SQLite', category: 'Web' },
  { name: 'HTML / CSS / JS', category: 'Web' },
];

export const SEED_PROJECTS = [
  {
    title: 'Micro Inverter',
    status: 'In progress',
    date: '2026',
    description:
      'A 12 V budget inverter built around a CD4047 oscillator, an LM317 and TYN616 thyristors, based on a circuit from Electronics For You. Includes a full component breakdown, a sourcing guide and cost estimates. College micro-project.',
    tags: ['CD4047', 'LM317', 'TYN616', 'Power electronics'],
    gradient: 'gold',
  },
  {
    title: 'ESP32 Hexapod Spider Robot',
    status: 'In progress',
    date: '2026',
    description:
      'A six-legged walking robot with 12 servos (two per leg) driven by a PCA9685 board, an HC-SR04 ultrasonic sensor for obstacle sensing and a tripod gait written for ESP32.',
    tags: ['ESP32', 'PCA9685', 'HC-SR04', 'Servo control'],
    gradient: 'cyan',
  },
  {
    title: 'ESP32 RC Tank & Security Alarm',
    status: 'In progress',
    date: '2026',
    description:
      'ESP32 projects built around a 4-motor tank drive using IBT-2 motor drivers, controlled over Bluetooth Serial with PWM speed control, plus an ESP32 based security alarm.',
    tags: ['ESP32', 'IBT-2', 'Bluetooth', 'PWM'],
    gradient: 'green',
  },
  {
    title: 'Pursuit-Evasion Robots (ROS2)',
    status: 'Completed',
    date: '2026',
    description:
      'Competition entry with TurtleBot 4 Lite in Gazebo using ROS2. Designed Catcher and Runner strategies using Pure Pursuit and the Dynamic Window Approach.',
    tags: ['ROS2', 'Gazebo', 'TurtleBot 4', 'Pure Pursuit', 'DWA'],
    gradient: 'violet',
  },
];

export const SEED_TIMELINE = [
  {
    date: 'Aug 2025 - Present',
    title: 'B.Tech, Electronics & Computer Engineering',
    subtitle: 'Madhav Institute of Technology & Science, Gwalior',
    content:
      'Working across embedded systems, power electronics and software: circuit design, firmware, data structures and full-stack basics.',
  },
  {
    date: '2026',
    title: 'AI Synergy Hackathon, Round 1',
    subtitle: 'ABV-IIITM Gwalior',
    content: 'Team entry on the governance case "One Complaint, Five Departments".',
  },
  {
    date: '2026',
    title: 'IBM Bob 2.0 Hackathon',
    subtitle: 'lablab.ai',
    content: 'Building a competition project around multi-agent orchestration.',
  },
];
