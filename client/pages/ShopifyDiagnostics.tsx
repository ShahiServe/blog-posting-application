import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, CircleAlert, LoaderCircle, RefreshCw, Store } from "lucide-react";

type Result = { status: "loading" | "success" | "error"; message: string; details?: string };

export default function ShopifyDiagnostics() {
  const [result, setResult] = useState<Result>({ status: "loading", message: "Checking your Shopify connection..." });
  async function checkConnection() {
    setResult({ status: "loading", message: "Checking your Shopify connection..." });
    try {
      const response = await fetch("/api/validate-shopify");
      const data = await response.json();
      setResult(response.ok && data.success
        ? { status: "success", message: "Your Shopify store is connected.", details: "Your store and blog are available. Articles created in the workspace will be saved as drafts." }
        : { status: "error", message: data.error || "We couldn't connect to Shopify.", details: data.suggestion || "Check that your Shopify credentials and blog permissions are configured on the server." });
    } catch {
      setResult({ status: "error", message: "We couldn't check your connection.", details: "Please try again." });
    }
  }
  useEffect(() => { void checkConnection(); }, []);
  return <main className="diagnostics-page"><Link to="/" className="diagnostics-back"><ArrowLeft size={15}/> Back to workspace</Link><div className="diagnostics-wrap"><div className="eyebrow muted">YOUR WORKSPACE CONNECTIONS</div><h1>Shopify connection</h1><p>Make sure your store is ready to receive your stories.</p><div className="diagnostics-card"><div className="diagnostics-card-heading"><span className="step-icon lavender"><Store size={20}/></span><div><h2>Shopify store</h2><p>Connection and blog access</p></div></div><div className={`diagnostics-result ${result.status}`}>{result.status === "loading" ? <LoaderCircle size={19} className="spin"/> : result.status === "success" ? <CheckCircle2 size={19}/> : <CircleAlert size={19}/>}<div><strong>{result.message}</strong>{result.details && <p>{result.details}</p>}</div></div><button className="button button-primary" onClick={checkConnection} disabled={result.status === "loading"}><RefreshCw size={15}/> Check again</button></div><p className="diagnostics-note">Credentials are configured on the server and are never shown in this workspace.</p></div></main>;
}
