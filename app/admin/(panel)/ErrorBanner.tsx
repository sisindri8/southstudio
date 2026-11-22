export default function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="mb-4 bg-flare p-3 text-sm text-white">{message}</p>;
}
