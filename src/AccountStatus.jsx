import React, { useEffect, useState } from 'react';
export default function AccountStatus({ busy }) {
  const desktop = window.caviardDesktop;
  const [state, setState] = useState(null), [working, setWorking] = useState(false), [error, setError] = useState(''), [offers, setOffers] = useState(false);
  useEffect(() => {
    if (!desktop?.accountState) return;
    let alive = true;
    desktop.accountState().then(value => { if (alive) setState(value); }).catch(() => {});
    const off = desktop.onAccount(value => { if (alive) setState(value); });
    return () => { alive = false; off(); };
  }, []);
  if (!state || state.phase === 'disabled') return null;
  const run = async fn => {
    setWorking(true); setError('');
    try { await fn(); } catch { setError('L’opération n’a pas abouti. Vérifiez votre connexion puis réessayez.'); }
    finally { setWorking(false); }
  };
  return <aside className="account-status" aria-label="Compte Inklura et crédits PDF">
    <div className="account-status-row">
      <strong>Compte Inklura</strong>
      <span aria-live="polite">{state.phase === 'signed-in' ? `${state.account?.remaining ?? 0} PDF disponibles` : state.phase === 'waiting' ? `Confirmez le code ${state.userCode} dans votre navigateur` : '20 PDF d’essai avec votre compte Inklura'}</span>
      {state.phase === 'signed-in' ? <>
        <button disabled={working || busy} onClick={() => run(() => desktop.refreshAccount())}>Actualiser</button>
        <button disabled={working || busy} onClick={() => setOffers(!offers)} aria-expanded={offers}>Offres et crédits</button>
        <button disabled={working || busy || !state.paymentsEnabled} onClick={() => run(() => desktop.billingPortal())}>Facturation</button>
        <button disabled={working || busy} onClick={() => run(() => desktop.signOut())}>Se déconnecter</button>
      </> : state.phase === 'waiting' ? <button disabled={working} onClick={() => run(() => desktop.cancelSignIn())}>Annuler la connexion</button> : <button className="primary" disabled={working || state.phase === 'connecting' || state.phase === 'loading'} onClick={() => run(() => desktop.signIn())}>{working ? 'Connexion…' : 'Se connecter à Inklura'}</button>}
    </div>
    {(error || state.message) && <p role="alert">{error || state.message}</p>}
    {state.account?.blocked && <p role="alert">La facturation de votre compte nécessite une vérification. Vos documents restent ouverts.</p>}
    {!!state.account?.reserved && <p>{state.account.reserved} export(s) en attente de synchronisation. Cliquez sur Actualiser après reconnexion.</p>}
    {offers && state.phase === 'signed-in' && <div className="account-offers">
      <p>Un crédit par export réussi. Importer, analyser ou annuler l’enregistrement ne consomme pas de crédit. Les packs sont valables 12 mois ; les quotas mensuels ne sont pas reportés.</p>
      {!state.paymentsEnabled && <p>Les achats ne sont pas encore activés. Les tarifs sont validés ; l’ouverture des paiements est en préparation.</p>}
      <div>{state.plans.map(plan => <article key={plan.id}><strong>{plan.label}</strong><span>{plan.documents} PDF {plan.kind === 'subscription' ? '/ mois / compte' : '· valables 12 mois'}</span><span>{(plan.priceCentsHt / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} HT{plan.kind === "subscription" ? " / mois" : ""}</span><button disabled={working || busy || !plan.purchasable} onClick={() => run(() => desktop.checkout(plan.id))}>{plan.purchasable ? 'Voir le prix et payer' : 'Bientôt disponible'}</button></article>)}</div>
      <small>Vos documents restent sur cet ordinateur. La connexion au compte, les crédits et le paiement utilisent Internet. Le mot de passe et le paiement sont saisis dans votre navigateur.</small>
    </div>}
  </aside>;
}
