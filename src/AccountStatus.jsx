import React, { useEffect, useRef, useState } from 'react';
export default function AccountStatus({ busy }) {
  const offersDialog = useRef(null);
  const deletionDialog = useRef(null);
  const desktop = window.caviardDesktop;
  const [state, setState] = useState(null), [working, setWorking] = useState(false), [error, setError] = useState(''), [offers, setOffers] = useState(false);
  const [selected, setSelected] = useState(null), [billing, setBilling] = useState({ name: '', line1: '', postalCode: '', city: '', country: 'FR' });
  const [deleting, setDeleting] = useState(false), [confirmation, setConfirmation] = useState('');
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
    if (deleting && state?.phase === 'signed-in') deletionDialog.current?.showModal();
    else deletionDialog.current?.close();
  }, [deleting, state?.phase]);
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
        {(state.externalPurchases !== false || state.apple) && <button disabled={working || busy} onClick={() => setOffers(!offers)} aria-expanded={offers}>Offres et crédits</button>}
        {state.externalPurchases !== false && <button disabled={working || busy || !state.paymentsEnabled} onClick={() => run(() => desktop.billingPortal())}>Facturation</button>}
        <button disabled={working || busy} onClick={() => run(() => desktop.signOut())}>Se déconnecter</button>
        {state.accountDeletionEnabled && <button disabled={working || busy} onClick={() => { setConfirmation(''); setError(''); setDeleting(true); }}>Supprimer mon compte PDF</button>}
      </> : state.phase === 'waiting' ? <button disabled={working} onClick={() => run(() => desktop.cancelSignIn())}>Annuler la connexion</button> : <button className="primary" disabled={working || state.phase === 'connecting' || state.phase === 'loading'} onClick={() => run(() => desktop.signIn())}>{working ? 'Connexion…' : 'Se connecter à Inklura'}</button>}
    </div>
    {(error || state.message) && <p role="alert">{error || state.message}</p>}
    {state.apple?.message && <p role="status">{state.apple.message}</p>}
    {state.apple?.pending && <p role="status">Votre achat Apple est en attente. Les crédits apparaîtront après validation ; cliquez sur Actualiser si la connexion a été interrompue.</p>}
    {state.purchasePending && <p role="status">Terminez le paiement dans votre navigateur. Vos crédits se mettent à jour automatiquement après confirmation de Stripe. Un paiement annulé n’ajoute aucun crédit.</p>}
    {state.account?.remaining === 0 && <p>Vous n’avez plus de crédits disponibles. {(state.externalPurchases !== false || state.apple) && 'Choisissez « Offres et crédits » pour en ajouter ; '}votre travail reste ouvert.</p>}
    {state.account?.blocked && <p role="alert">La facturation de votre compte nécessite une vérification. Vos documents restent ouverts.</p>}
    {!!state.account?.reserved && <p>{state.account.reserved} export(s) en attente de synchronisation. Cliquez sur Actualiser après reconnexion.</p>}
    {state.phase === 'signed-in' && state.accountDeletionEnabled && <dialog ref={deletionDialog} className="account-dialog" aria-labelledby="delete-pdf-title" onCancel={() => setDeleting(false)} onClose={() => setDeleting(false)}>
      <div className="dialog-title"><h2 id="delete-pdf-title">Supprimer mon compte PDF</h2></div>
      <form className="account-offers" onSubmit={event => { event.preventDefault(); run(async () => { await desktop.deletePdfAccount(confirmation); setDeleting(false); }); }}>
        <p>Cette suppression est définitive. Votre profil PDF, vos crédits restants et votre historique d’exports seront effacés. Les abonnements PDF souscrits sur le web seront résiliés sans nouveau prélèvement ; les achats ne sont pas automatiquement remboursés.</p>
        <p>Votre identifiant partagé et vos autres produits Inklura restent accessibles. Vos PDF, projets et exports enregistrés sur votre appareil restent à leur emplacement.</p>
        <p>Les pièces de facturation et les références de paiement nécessaires aux obligations comptables et aux remboursements sont conservées. La demande est enregistrée immédiatement ; si le prestataire de paiement ne répond pas, la suppression reprend automatiquement.</p>
        <label>Pour confirmer, saisissez SUPPRIMER MON COMPTE PDF<input autoComplete="off" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={working || busy || confirmation !== 'SUPPRIMER MON COMPTE PDF'}>Supprimer définitivement mon compte PDF</button>
        <button type="button" disabled={working} onClick={() => setDeleting(false)}>Conserver mon compte</button>
      </form>
    </dialog>}
    {state.phase === 'signed-in' && state.apple && <dialog ref={offersDialog} className="account-dialog" aria-labelledby="apple-offers-title" onCancel={() => setOffers(false)} onClose={() => setOffers(false)}>
      <div className="dialog-title"><h2 id="apple-offers-title">Crédits PDF · App Store</h2><button aria-label="Fermer les offres" onClick={() => setOffers(false)}>✕</button></div>
      <div className="account-offers">
        {error && <p role="alert">{error}</p>}
        <p>Un crédit par export réussi. Les crédits achetés sur l’App Store n’expirent pas et restent associés à votre compte Inklura. Importer, analyser ou annuler avant l’enregistrement ne consomme pas de crédit.</p>
        {!state.apple.enabled || !state.apple.products.length ? <p>Les achats Apple sont momentanément indisponibles. Vous pouvez utiliser vos crédits existants et actualiser les offres.</p> : null}
        <div>{state.apple.products.map(product => <article key={product.id}><strong>{product.label}</strong><span>Sans expiration</span><span>{product.formattedPrice}</span><button disabled={working || busy || state.apple.pending || !state.apple.enabled || state.account?.blocked} onClick={() => run(() => desktop.purchaseAppleCredits(product.id))}>Acheter avec l’App Store</button></article>)}</div>
        <button disabled={working || busy} onClick={() => run(() => desktop.refreshAccount())}>Actualiser les achats et les crédits</button>
        <small>Confirmez le montant dans la fenêtre de paiement Apple. Pour retrouver les crédits sur un autre Mac, connectez-vous au même compte Inklura. Vos PDF restent sur votre ordinateur.</small>
      </div>
    </dialog>}
    {state.phase === 'signed-in' && state.externalPurchases !== false && <dialog ref={offersDialog} className="account-dialog" aria-labelledby="account-offers-title" onCancel={() => setOffers(false)} onClose={() => setOffers(false)}>
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
