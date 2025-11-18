import "./Features.css";

export default function Features() {
  const features = [
    { title: "90+ WCAG Checks", desc: "Covers all major WCAG 2.1 AA rules." },
    { title: "AI-powered fixes", desc: "Smart suggestions for common issues." },
    { title: "EAA & ADA Ready", desc: "Legally compliant accessibility reports." },
    { title: "Dual-engine scan", desc: "axe-core + custom heuristics." },
  ];

  return (
    <section className="features-container">
      {features.map((item) => (
        <div className="feature-card" key={item.title}>
          <h3>{item.title}</h3>
          <p>{item.desc}</p>
        </div>
      ))}
    </section>
  );
}
