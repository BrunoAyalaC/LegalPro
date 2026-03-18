export default function EmptyState({ image, title, description, action }) {
  return (
    <div className="empty-state">
      {image && <img src={image} alt={title} />}
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
