const MESSAGES = [
  "The events page is under construction",
  "Please do not register for any events yet",
  "Registrations will open soon. Stay tuned!",
];

// a run repeats the messages so it is wider than wide screens; the track holds two
// runs and slides by exactly one, so the loop is seamless
const RUN = [...MESSAGES, ...MESSAGES, ...MESSAGES];

function Run({ hidden = false }: { hidden?: boolean }) {
  return (
    <div className="nt-run" aria-hidden={hidden || undefined}>
      {RUN.map((m, i) => (
        <span key={i} className="nt-item" aria-hidden={i >= MESSAGES.length || undefined}>
          <span className="nt-dot" aria-hidden="true">
            ✿
          </span>
          {m}
        </span>
      ))}
    </div>
  );
}

/** News-ticker strip pinned just below the site navbar on the events page. */
export default function NoticeTicker() {
  return (
    <div className="notice-ticker" role="status">
      <span className="nt-badge">Notice</span>
      <div className="nt-viewport">
        <div className="nt-track">
          <Run />
          <Run hidden />
        </div>
      </div>
    </div>
  );
}
