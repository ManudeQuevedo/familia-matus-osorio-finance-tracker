export function LoginPhotoAttribution({
  photographerName,
  photographerUrl,
  photoUrl,
}: {
  photographerName: string;
  photographerUrl: string;
  photoUrl: string;
}) {
  return (
    <p
      className="absolute bottom-4 left-4 z-20 text-[10px]"
      style={{ color: "rgba(255,255,255,0.3)" }}>
      Photo by{" "}
      <a
        href={photographerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="underline-offset-2 hover:underline">
        {photographerName}
      </a>{" "}
      on{" "}
      <a
        href={photoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="underline-offset-2 hover:underline">
        Unsplash
      </a>
    </p>
  );
}
