# UNO — Expo (multijoueur par code)

Un jeu de **UNO** multijoueur où l'on rejoint une partie avec un **code**.
Prêt à lancer sur **Expo Go (SDK 54)**. Aucun backend à déployer : le temps réel
passe par un **broker MQTT public gratuit** (WebSocket), donc ça marche tout de suite.

## 🚀 Lancer (depuis Termux)

```bash
cd uno-app
npm install
npx expo start
```

Puis :

1. Ouvre l'appli **Expo Go** sur ton téléphone (version SDK 54).
2. Scanne le **QR code** affiché dans le terminal.
   - Si le téléphone et l'ordi ne sont pas sur le même Wi-Fi, lance en mode tunnel :
     `npx expo start --tunnel`.

> Astuce Termux : si le QR ne se scanne pas, appuie sur `s` pour basculer en
> « Expo Go », et utilise le lien `exp://…` affiché.

## ✨ Fonctionnalités

- **Intro animée** : logo UNO + cartes qui s'ouvrent/se referment en éventail.
- **Mode solo (vs bots)** : joue seul contre 1 à 3 bots à stratégie
  **déterministe** — pratique pour tester/débugger sans plusieurs téléphones.
- **Multijoueur par code** : crée une partie, partage le code, les autres
  rejoignent.
- **Animations** : cartes qui volent vers ta main à la pioche, effet **+2 / +4**
  plein écran avec secousse et vibration (haptique), rebond de la défausse,
  pulsation quand c'est ton tour, cartes distribuées en fondu.
- **Cash 💰** : à chaque manche gagnée tu remportes du cash (barème UNO :
  chiffres = valeur, actions = 20, jokers = 50, + bonus). Solde **persistant**
  (sauvegardé sur l'appareil), compteur animé sur l'écran de victoire.
- **Boutons Quitter** partout (avec confirmation).

## 🏆 Progression & méta

- **Mystery Box** : skin aléatoire pas cher, doublons → 💎 éclats → craft d'un skin choisi.
- **Skins visibles par tous** : en partie tu vois le dos (sleeve) de chaque joueur.
- **Battle pass saisonnier** (gratuit + premium) : 15 paliers, récompenses cash/éclats/boîtes/skins.
- **Missions** quotidiennes & hebdo (gagne, joue un +4, bloque une attaque…).
- **Clans (4)** : Guerrier 🛡️ (bouclier 5 tours), Ensorceleur 🔮 (sort), Voleur 🗡️ (vol), Oracle 🌟 (purge). Carte-pouvoir signature en main + blason sur ton chip.
- **Chat écrit** en salon et en partie (multijoueur).
- **Nouveaux effets** : +4 fait exploser des cartes sur le tapis, le sens inverse fait tourner le paquet, badges bouclier/sort/vol.

## 🃏 Cartes spéciales & extras

- **🔄 Échange** : échange toute ta main avec un joueur ciblé.
- **♻️ Renouveau** : force un joueur à rendre sa main et piocher une main neuve.
- **🔒 Blocage** : le Skip pose un cadenas animé sur le joueur bloqué.
- **Badge « TON TOUR »** bien visible + vibration quand ton tour arrive.
- **Paris** : mise du cash sur un vainqueur avant la partie (cote = nb de joueurs).
- **Boutique de sleeves** : skins animés (Feu, Éclairs, Holo, Yu-Gi-Oh, Or) à
  acheter avec ton cash et à équiper — le dos de tes cartes change en jeu.
- **Table de croupier** : feutrine verte, dos de cartes, effets.

## 🎮 Comment jouer

1. **Un joueur** crée la partie → il obtient un **code** (ex. `K7P2M`).
2. **Les autres** entrent ce code et rejoignent le salon.
3. L'hôte appuie sur **Lancer la partie** (2 à 8 joueurs).
4. Règles UNO classiques :
   - jouer une carte de même **couleur** ou même **valeur** que celle du dessus ;
   - **+2**, **Passe** (⦸), **Sens inverse** (⇄), **Joker** (★), **+4** ;
   - piocher si on ne peut pas jouer (bouton **Passer** ensuite) ;
   - premier à vider sa main **gagne**. Une carte en main = **UNO !**

## 🧩 Architecture

| Fichier | Rôle |
|---|---|
| `src/engine.js` | Moteur de jeu UNO (logique pure, testée) |
| `src/net.js` | Transport temps réel MQTT/WebSocket + codes de partie |
| `src/components/Card.js` | Rendu d'une carte |
| `App.js` | Écrans (accueil, salon, partie) et orchestration |

**Modèle :** l'hôte fait autorité. Tout le monde publie ses actions sur le
broker ; l'hôte les valide avec le moteur et rediffuse l'état. Les invités
affichent l'état reçu.

## 🔧 Changer de broker

Un seul endroit à modifier — `src/net.js` :

```js
export const BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';
```

Autres brokers publics MQTT/WSS possibles (l'hôte **et** les invités doivent
utiliser le même) :

- `wss://test.mosquitto.org:8081/mqtt`
- `wss://broker.hivemq.com:8884/mqtt`

## ⚠️ Notes

- Le broker est **public** : pour une partie entre amis c'est parfait, mais
  l'état complet transite en clair. Les codes de partie sont aléatoires
  (32⁵ ≈ 33 M combinaisons) pour éviter les collisions.
- Si l'hôte quitte, la partie s'arrête (modèle hôte-autoritaire).
