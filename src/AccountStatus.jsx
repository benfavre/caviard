import React, { useEffect, useRef, useState } from 'react';
export default function AccountStatus({ busy }) {
  const offersDialog = useRef(null);
  const desktop = window.caviardDesktop;
  const [state, setState] = useState(null), [working, setWorking] = useState(false), [error, setError] = useState(''), [offers, setOffers] = useState(false);
  const [selected, setSelected] = useState(null), [billing, setBilling] = useState({ name: '', line1: '', postalCode: '', city: '', country: 'FR' });
  const money = cents => (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  useEffect(() => { setSelected(null); setBilling({ name: '', line1: '', postalCode: '', city: '', country: 'FR' }); }, [state?.account?.accountId]);
  useEffect(() => {
    if (!desktop?.accountState) return;
    let alive = true;
    desktop.accountState().then(value => { if (alive) setState(value); }).catch(() => {});
    const off = desktop.onAccount(value => { if (alive) setState(value); });
    return () => { alive = false; off(); };
  }, []);
  useEffect(() => {
    const dialog = offersDialog.current;
    if (offers && state?.phase === 'signed-in') dialog?.showModal();
    else dialog?.close();
  }, [offers, state?.phase]);
  useEffect(() => {
    if (!desktop?.refreshAccount || state?.phase !== 'signed-in') return;
    const refresh = () => { desktop.refreshAccount().catch(() => {}); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [state?.phase]);
  if (!state || state.phase === 'disabled') return null;
  const run = async fn => {
    setWorking(true); setError('');
    try { await fn(); } catch (failure) { setError(failure.message || 'L’opération n’a pas abouti. Vérifiez votre connexion puis réessayez.'); }
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
    {state.purchasePending && <p role="status">Terminez le paiement dans votre navigateur. Vos crédits se mettent à jour automatiquement après confirmation de Stripe. Un paiement annulé n’ajoute aucun crédit.</p>}
    {state.account?.remaining === 0 && <p>Vous n’avez plus de crédits disponibles. Choisissez « Offres et crédits » pour en ajouter ; votre travail reste ouvert.</p>}
    {state.account?.blocked && <p role="alert">La facturation de votre compte nécessite une vérification. Vos documents restent ouverts.</p>}
    {!!state.account?.reserved && <p>{state.account.reserved} export(s) en attente de synchronisation. Cliquez sur Actualiser après reconnexion.</p>}
    {state.phase === 'signed-in' && <dialog ref={offersDialog} className="account-dialog" aria-labelledby="account-offers-title" onCancel={() => setOffers(false)} onClose={() => setOffers(false)}>
      <div className="dialog-title"><h2 id="account-offers-title">Offres et crédits</h2><button aria-label="Fermer les offres" onClick={() => setOffers(false)}>✕</button></div>
      <div className="account-offers">
      {error && <p role="alert">{error}</p>}
      <p>Un crédit par export réussi. Importer, analyser ou annuler l’enregistrement ne consomme pas de crédit. Les packs sont valables 12 mois ; les quotas mensuels ne sont pas reportés.</p>
      <p>Achats réservés à la France métropolitaine. TVA 20 %. Les abonnements sont résiliables pour la prochaine échéance.</p>
      {!state.paymentsEnabled && <p>Les achats ne sont pas encore activés. Les tarifs sont validés ; l’ouverture des paiements est en préparation.</p>}
      <div>{state.plans.map(plan => <article key={plan.id}><strong>{plan.label}</strong><span>{plan.documents} PDF {plan.kind === 'subscription' ? '/ mois / compte' : '· valables 12 mois'}</span><span>{money(plan.priceCentsTtc ?? Math.round(plan.priceCentsHt * 1.2))} TTC{plan.kind === 'subscription' ? ' / mois' : ''}</span><small>{money(plan.priceCentsHt)} HT</small><button disabled={working || busy || !plan.purchasable} onClick={() => { setError(''); setSelected(plan); }}>{plan.purchasable ? 'Choisir cette offre' : 'Bientôt disponible'}</button></article>)}</div>
      {selected && <form className="account-billing" onSubmit={event => { event.preventDefault(); run(async () => { await desktop.checkout(selected.id, billing); setSelected(null); }); }}>
        <h3>Facturation · {selected.label}</h3>
        <p>Votre adresse doit être en France métropolitaine. Confirmez le montant sur Stripe avant de payer.</p>
        {[['name', 'Nom ou raison sociale', 'organization'], ['line1', 'Adresse', 'street-address'], ['postalCode', 'Code postal', 'postal-code'], ['city', 'Ville', 'address-level2']].map(([key, label, autoComplete]) => <label key={key}>{label}<input required minLength={key === 'postalCode' ? 5 : 2} maxLength={key === 'postalCode' ? 5 : 150} pattern={key === 'postalCode' ? '(0[1-9]|[1-8][0-9]|9[0-5])[0-9]{3}' : undefined} title={key === 'postalCode' ? 'Code postal de France métropolitaine (hors Monaco et outre-mer)' : undefined} autoComplete={autoComplete} value={billing[key]} onChange={event => setBilling({ ...billing, [key]: event.target.value })} /></label>)}
        <label>Pays<input value="France métropolitaine" readOnly /></label>
        <button type="submit" className="primary" disabled={working || busy}>Continuer vers Stripe · {money(selected.priceCentsTtc ?? Math.round(selected.priceCentsHt * 1.2))} TTC{selected.kind === 'subscription' ? ' / mois' : ''}</button>
        <button type="button" disabled={working} onClick={() => setSelected(null)}>Annuler</button>
      </form>}
      <small>Vos documents restent sur cet ordinateur. La connexion au compte, les crédits et le paiement utilisent Internet. Le mot de passe et le paiement sont saisis dans votre navigateur.</small>
    </div></dialog>}
  </aside>;
}
