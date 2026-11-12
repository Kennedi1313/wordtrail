"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="route-error" role="alert">
      <div className="route-error-card">
        <span className="eyebrow">NÃO FOI POSSÍVEL CARREGAR</span>
        <h1>O servidor não respondeu</h1>
        <p>Recarregue a página quando a conexão estiver disponível.</p>
        <button className="button" type="button" onClick={() => reset()}>
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
