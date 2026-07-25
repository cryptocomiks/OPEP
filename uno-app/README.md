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

## 🕹️ Extras & jeu secret

- **Carte mystère** : pendant une partie, une carte ❓ dorée apparaît au hasard — le 1er à la toucher gagne +500$ (ou en perd un peu, c'est risqué).
- **Sprites de personnage** : chaque joueur a un avatar qui le symbolise (visible en partie et au salon). **Boîte Personnage** dans la boutique pour en débloquer d'autres.
- **Chat vocal simultané** : tout le monde peut parler en même temps (les notes se superposent à la lecture). Maintien du 🎤.
- **🥚 Easter egg** : tape **3 fois** sur la carte de la défausse (ou sur le logo UNO) pour ouvrir le **jeu secret** — un mini-RPG de capture de monstres dans la ville de **Lavenvyl** : balade-toi, affronte des créatures dans les hautes herbes, capture-les, complète ton **Pokédex**, et achète Balls/Potions **avec ton cash UNO**. Musique chiptune incluse 🎵.

## 🔊 Son, voix & rang

- **Design sonore** : effets pour chaque carte/action (pose, pioche, +2/+4, bouclier, échange, vol, victoire) + son « à toi ». Bouton 🔊/🔇 sur l'accueil.
- **Chat en direct en partie** : les messages apparaissent en bulles flottantes pendant la partie (pas seulement dans le panneau).
- **Chat vocal (push-to-talk)** : maintiens le 🎤 pour enregistrer une note vocale, relâche pour l'envoyer aux autres joueurs (Expo Go n'a pas de WebRTC → notes vocales courtes plutôt que live).
- **Classement ELO** : rating + paliers (Bois → Champion), rang affiché sur toi et tes adversaires, gains/pertes de points, animation de montée de rang.
- **Animations de combat** : slash + flash rouge sur les attaques, badge de pioche.

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
