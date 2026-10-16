# 🌸 Udgam 3D Interactive World

A Mood Indigo-style 3D interactive festival website for **Udgam — IIT Gandhinagar's Annual Cultural Festival**.

---

## 🚀 How to Run

Simply open `index.html` in any modern browser (Chrome, Firefox, Edge).

> **Note:** For photos to load, you need to serve the files via a local server (not just open the file directly), because browsers block loading local images with `file://` protocol.
>
> **Easy way:** Use VS Code's [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension, or run:
> ```bash
> npx serve .
> ```
> Then open `http://localhost:3000`

---

## 🕹️ Controls

| Platform | Action | Control |
|---|---|---|
| PC | Move character | Arrow Keys or WASD |
| PC | Rotate camera | Mouse drag (click + drag) |
| PC | Zoom camera | Scroll wheel |
| PC | Open gallery | Walk near banner, press **E** |
| Mobile | Move character | Virtual joystick (bottom left) |
| Mobile | Rotate camera | Buttons (bottom right) |
| Mobile | Open gallery | Walk near banner, tap the prompt |

---

## 📸 Adding Photos

Drop your Udgam event photos into the corresponding folder:

```
images/
├── udgam2k25/    ← Photos for Udgam 2K25
│   ├── 1.jpg
│   ├── 2.jpg
│   └── ...
├── udgam2k24/
├── udgam2k23/
├── udgam2k22/
├── udgam2k21/
├── udgam2k20/
├── udgam2k19/
└── udgam2k18/
```

**Supported formats:** `.jpg`, `.jpeg`, `.png`, `.webp`

**Naming:** Name files `1.jpg`, `2.jpg`, `3.jpg`, etc. (up to 10 per edition by default).

---

## 🔗 Adding Website URLs

Open `gallery.js` and update the `url` field for each edition:

```javascript
{
  key: 'udgam2k25',
  title: 'Udgam 2K25',
  url: 'https://your-udgam-2025-url.com',  // ← Update this
  ...
}
```

---

## 🎨 Features

- 🌸 Cherry blossom theme with falling petals
- 🌳 3D cherry blossom trees with glowing blossoms
- 🌙 Dark festival night sky with stars
- ✨ Glowing orb avatar (you) with orbit ring
- 🗼 8 glowing billboard banners (one per Udgam edition)
- 📷 Photo gallery popup with animations and navigation
- 🗺️ Minimap showing your position
- 📱 Virtual joystick for mobile
- 🔊 Proximity detection — banners glow when you approach
