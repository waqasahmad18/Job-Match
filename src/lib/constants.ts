export const DEFAULT_ROLES = [
  "Full Stack Developer",
  "Full Stack Engineer",
  "MERN Stack Developer",
  "React Developer",
  "Next.js Developer",
  "Node.js Developer",
  "Backend Developer",
  "PHP Developer",
  "Laravel Developer",
  "Python Developer",
  "Django Developer",
  "Software Engineer",
  "Software Developer",
  "Web Application Developer",
];

export const DEFAULT_TECHNOLOGIES = [
  "React",
  "Next.js",
  "JavaScript",
  "TypeScript",
  "HTML",
  "CSS",
  "Node.js",
  "Express",
  "PHP",
  "Laravel",
  "Python",
  "Django",
  "MongoDB",
  "MySQL",
  "PostgreSQL",
  "REST APIs",
  "Git",
];

export const DEFAULT_EXCLUSIONS = [
  "WordPress",
  "Shopify",
  "Elementor",
  "WooCommerce",
  "Shopify Liquid",
];

export const DEFAULT_LOCATIONS = [
  "Remote worldwide",
  "Remote Pakistan",
  "Onsite Lahore only",
];

export const DEFAULT_EXCLUDED_COMPANIES = ["Interact Global"];

export const DEFAULT_ONSITE_CITIES = ["Lahore"];

export const DEFAULT_SETTINGS = {
  locations: DEFAULT_LOCATIONS,
  roles: DEFAULT_ROLES,
  targetTechnologies: DEFAULT_TECHNOLOGIES,
  excludedTechnologies: DEFAULT_EXCLUSIONS,
  excludedCompanies: DEFAULT_EXCLUDED_COMPANIES,
  onsiteCities: DEFAULT_ONSITE_CITIES,
  skills: DEFAULT_TECHNOLOGIES,
  matchThreshold: Number(process.env.MATCH_THRESHOLD || 80),
  dailySendLimit: Number(process.env.DAILY_SEND_LIMIT || 50),
  minSalaryPkr: 80_000,
  cooldownDays: 14,
  autoSend: true,
  applicantName: process.env.APPLICANT_NAME || "Waqas Rafique",
  applicantEmail: process.env.APPLICANT_EMAIL || "vickyksr2218@gmail.com",
  smtpUser: process.env.SMTP_USER || "vickyksr2218@gmail.com",
  smtpPassword: "",
  smtpFrom: process.env.EMAIL_FROM || "Waqas Rafique <vickyksr2218@gmail.com>",
  smtpReady: false,
};

export const EXCLUSION_PATTERNS = [
  "wordpress",
  "shopify",
  "elementor",
  "woocommerce",
  "shopify liquid",
  "wp-admin",
  "woocommerce",
];
