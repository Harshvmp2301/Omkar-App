import { Component } from "react";

/**
 * App-level error boundary: a themed fallback instead of a white screen.
 * Deliberately dependency-free and bilingual-safe (static copy — `t` may be
 * what crashed).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Omkar Samithi render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app" role="alert">
          <div className="section" style={{ maxWidth: 460, paddingTop: 90, textAlign: "center" }}>
            <h2 className="section-title display">ಓಂಕಾರ ಸಮಿತಿ · Omkar Samithi</h2>
            <p className="view-sub" style={{ marginTop: 12 }}>
              Something went wrong rendering this page. Your saved data is untouched —
              please reload to continue. / ಈ ಪುಟವನ್ನು ತೋರಿಸುವಲ್ಲಿ ದೋಷವಾಗಿದೆ. ಮರುಹೊಂದಿಸಿ.
            </p>
            <button
              type="button"
              className="btn-primary"
              style={{ maxWidth: 240, margin: "0 auto" }}
              onClick={() => window.location.reload()}
            >
              Reload · ಮರುಹೊಂದಿಸಿ
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
