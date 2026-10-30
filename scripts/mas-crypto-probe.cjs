// Read-only runtime inventory. No account login, credential use or HTTP request.
const tls = require('node:tls');
const crypto = require('node:crypto');
const targets = ['outils.inklura.fr', 'auth.1clic.pro', 'huggingface.co', 'raw.githubusercontent.com'];
async function handshake(host, version) {
  return new Promise(resolve => {
    const socket = tls.connect({host, port:443, servername:host, minVersion:version, maxVersion:version, rejectUnauthorized:true});
    const done = result => { socket.destroy(); resolve({host, requestedVersion:version, ...result}); };
    socket.setTimeout(15000, () => done({error:'timeout'}));
    socket.once('error', error => done({error:error.code || 'TLS error'}));
    socket.once('secureConnect', () => {
      try {
        const certificate = new crypto.X509Certificate(socket.getPeerCertificate().raw);
        done({authorized:socket.authorized, protocol:socket.getProtocol(), cipher:socket.getCipher(), ephemeralKey:socket.getEphemeralKeyInfo(), peerPublicKey:{type:certificate.publicKey.asymmetricKeyType, details:certificate.publicKey.asymmetricKeyDetails}});
      } catch (error) { done({error:error.code || 'certificate inspection failed'}); }
    });
  });
}
(async () => {
  const result = {platform:process.platform,arch:process.arch,versions:process.versions,defaultMin:tls.DEFAULT_MIN_VERSION,defaultMax:tls.DEFAULT_MAX_VERSION,defaultCiphers:tls.DEFAULT_CIPHERS,enabledCipherSuites:tls.getCiphers(),defaultGroups:tls.DEFAULT_ECDH_CURVE,handshakes:[]};
  for(const host of targets) for(const version of ['TLSv1.2','TLSv1.3']) result.handshakes.push(await handshake(host,version));
  console.log('INKLURA_CRYPTO_REPORT='+JSON.stringify(result));
})();
