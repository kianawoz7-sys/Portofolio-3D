export type ProjectCompositionDirection = "left" | "right";

export interface ProjectAccentMetadata {
  color?: string;
  signal?: string;
}

export interface Project {
  id: string;
  title: string;
  category: string;
  shortCategory: string;
  description: string;
  compactDescription?: string;
  imagePath: string;
  imageAlt: string;
  technologyStack: string[];
  artifactLabel: string;
  ctaLabel: string;
  caseStudyUrl?: string;
  featureHighlights?: string[];
  features?: string[];
  compositionDirection?: ProjectCompositionDirection;
  accent?: ProjectAccentMetadata;
}

/**
 * The Digital Archive's single source of truth.
 * Adding an object here automatically creates a vault, camera checkpoint,
 * journey-thread destination, scroll segment, and archive numbering.
 */
export const PROJECTS: Project[] = [
  {
    id: "maximum-gym",
    title: "Maximum Gym",
    category: "COMPANY PROFILE WEBSITE",
    shortCategory: "APLIKASI WEB",
    description: "Website company profile untuk pusat kebugaran yang dirancang sebagai wajah digital Maximum Gym. Proyek ini menampilkan identitas brand melalui antarmuka yang modern, responsif, dan mudah dijelajahi.",
    compactDescription: "Website company profile modern dan responsif untuk memperkenalkan identitas digital Maximum Gym.",
    imagePath: "/Maximum-Gym.png",
    imageAlt: "Preview website company profile Maximum Gym",
    technologyStack: ["React", "Node.js", "Supabase", "Tailwind"],
    artifactLabel: "BRAND EXPERIENCE SYSTEM",
    ctaLabel: "KUNJUNGI WEBSITE",
    caseStudyUrl: "https://maximum-gym-black.vercel.app/",
    compositionDirection: "left",
    accent: { color: "#9eddf1", signal: "MG-01" },
  },
  {
    id: "orgaku",
    title: "OrgaKu",
    category: "APLIKASI MANAJEMEN ORGANISASI",
    shortCategory: "APLIKASI ANDROID",
    description: "OrgaKu adalah aplikasi manajemen organisasi yang menyatukan pengelolaan tugas, jadwal rapat, absensi QR, dokumen, notifikasi, dan koordinasi anggota dalam satu tempat.",
    compactDescription: "Aplikasi manajemen organisasi untuk mengatur tugas, rapat, absensi, dokumen, dan kolaborasi anggota.",
    imagePath: "/Orgaku.jpeg",
    imageAlt: "Preview aplikasi manajemen organisasi OrgaKu",
    technologyStack: ["React", "Firebase", "TypeScript", "Vite"],
    artifactLabel: "ORGANIZATION OPERATING SYSTEM",
    ctaLabel: "LIHAT STUDI KASUS",
    featureHighlights: ["MANAJEMEN TUGAS", "ABSENSI QR", "JADWAL RAPAT", "REAL-TIME NOTIFICATION"],
    features: [
      "Autentikasi email/password",
      "Google Sign-In",
      "Manajemen tugas dan sub-task",
      "Jadwal rapat organisasi",
      "Absensi QR Code",
      "Rekap absensi ke Excel",
      "Dokumen organisasi",
      "Push notification real-time",
      "Undang anggota",
      "Dark Mode",
    ],
    compositionDirection: "right",
    accent: { color: "#b8ced8", signal: "OK-02" },
  },
];

export function resolveProjectComposition(project: Project, index: number): ProjectCompositionDirection {
  return project.compositionDirection ?? (index % 2 === 0 ? "left" : "right");
}
