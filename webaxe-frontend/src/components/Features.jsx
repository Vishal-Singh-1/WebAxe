import "./Features.css";

export default function Features() {
  const features = [
    {
      title: "Legal compliance",
      desc: "Focus reporting around accessibility expectations tied to WCAG, EAA, and broader compliance risk."
    },
    {
      title: "Deep scanning",
      desc: "Run structured website scans with detailed findings, readable issue grouping, and repeatable workflows."
    },
    {
      title: "60+ WCAG checks",
      desc: "Automated WCAG A and AA checks help surface high-impact accessibility issues across key page patterns."
    },
    {
      title: "Sector-based scanning",
      desc: "Choose website sectors like healthcare, government, ecommerce, or kids for a more tailored scan flow."
    }
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
