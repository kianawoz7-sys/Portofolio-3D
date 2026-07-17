import { forwardRef } from "react";

import { MagneticImage } from "../ui/MagneticImage";

const capabilities = [
  { title: "Pemikiran Antarmuka", desc: "Merancang pengalaman front-end yang bersih, dapat digunakan, dan halus secara visual." },
  { title: "Struktur Sistem", desc: "Membangun logika back-end yang andal, database, autentikasi, dan API." },
  { title: "Eksekusi Produk", desc: "Menghubungkan desain, pengembangan, dan penerapan menjadi produk digital yang berfungsi." },
];

export const AboutArchiveContent = forwardRef<HTMLDivElement>(function AboutArchiveContent(_, ref) {
  return (
    <div ref={ref} className="memory-anchor-exhibit" aria-labelledby="memory-title">
      <div className="memory-anchor-exhibit__thread" aria-hidden="true"><i /></div>

      <div className="memory-anchor-artifact">
        <div className="memory-anchor-artifact__fog" aria-hidden="true" />
        <div className="memory-anchor-artifact__orbit" aria-hidden="true"><i /><i /></div>
        <div className="memory-anchor-artifact__frame">
          <MagneticImage
            whileHover={{ scale: 1.025 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            alt="Denanda Ukky - Pengembang Full-stack"
            className="h-full w-full object-cover grayscale transition-all duration-700 hover:grayscale-0"
            src="/Person1.jpeg"
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
        </div>
        <div className="memory-anchor-artifact__index font-label-caps">ARCHIVE / DU-01</div>
      </div>

      <div className="memory-anchor-record">
        <div className="chapter-kicker memory-anchor-record__kicker">
          <span>02</span>
          <i />
          <span>MEMORY CHAMBER</span>
        </div>
        <h2 id="memory-title" className="font-headline-md">
          Pengembangan full-stack dengan selera front-end dan disiplin back-end.
        </h2>
        <p className="memory-anchor-record__lead font-body-lg">
          Denanda Ukky membangun produk digital yang menyeimbangkan antarmuka yang halus, sistem yang andal, dan pengalaman pengguna yang bermakna. Pekerjaannya berfokus pada mengubah ide menjadi aplikasi web yang bersih, skalabel, dan mudah dikelola.
        </p>

        <div className="memory-anchor-modules">
          {capabilities.map((item, index) => (
            <div key={item.title} className="memory-anchor-module">
              <span className="font-label-caps">0{index + 1}</span>
              <div>
                <h3 className="font-label-caps">{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
