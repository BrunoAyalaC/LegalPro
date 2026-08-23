export default function EmptyState({ image, imageWebp, title, description, action }) {
  return (
    <div className="empty-state">
      {image && (
        imageWebp ? (
          <picture>
            <source srcSet={imageWebp} type="image/webp" />
            <img src={image} alt={title} loading="lazy" decoding="async" />
          </picture>
        ) : (
          <img src={image} alt={title} loading="lazy" decoding="async" />
        )
      )}
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
