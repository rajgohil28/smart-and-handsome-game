(() => {
  "use strict";

  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const stateEl = document.getElementById("state");
  const overlay = document.getElementById("overlay");
  const startBtn = document.getElementById("start");
  const rotatePrompt = document.getElementById("rotate-prompt");
  const gameWrap = document.getElementById("game-wrap");
  const hudEl = document.querySelector(".hud");
  const lottieContainer = document.getElementById("lottie-container");

  /* ---------- Orientation enforcement ---------- */
  function checkOrientation() {
    if (window.innerHeight > window.innerWidth) {
      rotatePrompt.style.display = "flex";
      gameWrap.style.visibility = "hidden";
      gameWrap.style.height = "0";
    } else {
      rotatePrompt.style.display = "none";
      gameWrap.style.visibility = "visible";
      gameWrap.style.height = "100%";
    }
  }

  window.addEventListener("load", checkOrientation);
  window.addEventListener("resize", checkOrientation);
  window.addEventListener("orientationchange", function () {
    setTimeout(checkOrientation, 100);
  });

  /* ---------- Constants ---------- */
  const BIKE_DISPLAY_W = 160;
  const BIKE_DISPLAY_H = 140;
  const WHEELIE_ANGLE = -45;
  const WHEELIE_DURATION = 1;
  const ingredientsPalette = ["#f8d15b", "#6fd3f2", "#f48fa6", "#7ce3b1"];

  /* ---------- Scene ---------- */
  class MainScene extends Phaser.Scene {
    constructor() {
      super("MainScene");
      this.player = null;
      this.bg = null;
      this.ingredients = null;
      this.enemies = null;
      this.wheelieTime = 0;
      this.score = 0;
      this.lives = 3;
      this.nextSpawnTimer = 0;
      this.worldSpeed = 320;
      this.running = false;
      this.groundY = 0;
    }

    preload() {
      this.load.on("loaderror", (file) => {
        console.error("Failed to load asset:", file.key, file.url);
      });

      this.load.spritesheet("bike", "assets/Images/Bike-Sheet.png", {
        frameWidth: 297,
        frameHeight: 258
      });
      this.load.image("bg", "assets/Images/bg4.png");
      this.load.audio("motorcycle", "assets/sounds/motorcycle.mp3");
      this.load.audio("hit_sound", "assets/sounds/hit.mp3");
      this.load.audio("coin_sound", "assets/sounds/coin.mp3");
      this.load.audio("victory_sound", "assets/sounds/Victory.mp3");
      this.load.spritesheet("explosion", "assets/animations/Dustexplosion.png", {
        frameWidth: 600,
        frameHeight: 525
      });
      this.load.spritesheet("bike_dust", "assets/Images/Bike-Dust.png", {
        frameWidth: 480,
        frameHeight: 436
      });
      
      // New Pickups
      this.load.spritesheet("niancinamide", "assets/Images/niancinamide.png", {
        frameWidth: 500,
        frameHeight: 500
      });
      this.load.image("methanol_1", "assets/Images/Methanol_1.png");
      this.load.image("methanol_2", "assets/Images/Methanol_2.png");
      this.load.image("methanol_3", "assets/Images/Methanol_3.png");
      this.load.image("methanol_glow", "assets/Images/Methanol _glow_gradient.png");
      this.load.spritesheet("virus", "assets/Images/virus.png", {
        frameWidth: 480,
        frameHeight: 480
      });

      this.load.image("end_credits", "assets/Images/End_Credits.jpeg");
      this.load.image("tube", "assets/Images/S&H_Tube.png");
      this.load.image("bike_glow", "assets/Images/Glow_Bike.png");
    }

    create() {
      const w = this.scale.width;
      const h = this.scale.height;
      this.groundY = Math.round(h * 0.845) + 7;

      this.motorcycleSound = this.sound.add("motorcycle", { loop: true, volume: 0.2 });
      this.hitSound = this.sound.add("hit_sound", { volume: 0.5 });
      this.coinSound = this.sound.add("coin_sound", { volume: 0.5 });
      this.victorySound = this.sound.add("victory_sound", { volume: 0.6 });

      // Pause/resume sound when user switches tabs
      document.addEventListener("visibilitychange", () => {
        if (!this.motorcycleSound) return;
        if (document.hidden) {
          if (this.motorcycleSound.isPlaying) this.motorcycleSound.pause();
        } else {
          if (this.running && this.motorcycleSound.isPaused) this.motorcycleSound.resume();
        }
      });

      if (!this.anims.exists("explode")) {
        this.anims.create({
          key: "explode",
          frames: this.anims.generateFrameNumbers("explosion", { start: 0, end: 4 }),
          duration: 300,
          repeat: 0
        });
      }

      if (!this.anims.exists("dust_anim")) {
        this.anims.create({
          key: "dust_anim",
          frames: this.anims.generateFrameNumbers("bike_dust", { start: 0, end: 12 }),
          frameRate: 20,
          repeat: -1
        });
      }

      if (!this.anims.exists("niancinamide_anim")) {
        this.anims.create({
          key: "niancinamide_anim",
          frames: this.anims.generateFrameNumbers("niancinamide", { start: 0, end: 199 }),
          frameRate: 30,
          repeat: -1
        });
      }

      if (!this.anims.exists("virus_anim")) {
        this.anims.create({
          key: "virus_anim",
          frames: this.anims.generateFrameNumbers("virus", { start: 0, end: 40 }),
          frameRate: 15,
          repeat: -1
        });
      }

      if (!this.anims.exists("bike_anim")) {
        this.anims.create({
          key: "bike_anim",
          frames: this.anims.generateFrameNumbers("bike", { start: 0, end: 2 }),
          frameRate: 10,
          repeat: -1
        });
      }

      this.bg = this.add.tileSprite(0, 0, w || 1280, h || 720, "bg");
      this.bg.setOrigin(0, 0);
      this.bg.setDepth(-1);
      const bgScale = Math.max((w || 1280) / 6000, (h || 720) / 805);
      this.bg.tileScaleX = bgScale;
      this.bg.tileScaleY = bgScale;

      this.player = this.add.sprite((w || 1280) * 0.18 + 60, this.groundY, "bike");
      this.player.setOrigin(0.15, 0.95);
      this.player.setDepth(10);
      this.player.displayWidth = BIKE_DISPLAY_W;
      this.player.displayHeight = BIKE_DISPLAY_H;
      this.player.play("bike_anim");

      this.bikeGlow = this.add.image(this.player.x, this.player.y, "bike_glow");
      this.bikeGlow.setOrigin(0.5, 0.5); 
      this.bikeGlow.setDepth(11); 
      this.bikeGlow.setDisplaySize(BIKE_DISPLAY_W * 2.7, BIKE_DISPLAY_H * 2.7);
      this.bikeGlow.setAlpha(0);
      this.bikeGlow.setVisible(false);

      this.dust = this.add.sprite(0, 0, "bike_dust");
      this.dust.setOrigin(1, 0.95);
      this.dust.setDepth(5); // Behind bike
      this.dust.setVisible(false);
      this.dust.play("dust_anim");
      this.dust.setScale(0.4);

      this.ingredients = this.add.group();
      this.enemies = this.add.group();

      this.tube = this.add.image(40, h / 2 + 50, "tube");
      this.tube.setOrigin(0, 0.5);
      this.tube.setDepth(50); // Below end screen layer
      const tubeTargetH = h * 0.49;
      this.tube.setDisplaySize(tubeTargetH * (this.tube.width / this.tube.height), tubeTargetH);

      this.scale.on("resize", this.onResize, this);

      this.resetGameState();
      this.setupInput();
      this.running = false;
    }

    onResize(gameSize) {
      const w = gameSize.width;
      const h = gameSize.height;
      if (w <= 0 || h <= 0) return;

      this.groundY = Math.round(h * 0.845) + 12;

      if (this.bg) {
        this.bg.setSize(w, h);
        const s = Math.max(w / 6000, h / 805);
        this.bg.tileScaleX = s;
        this.bg.tileScaleY = s;
      }
      if (this.player) {
        this.player.x = w * 0.18 + 60;
        this.player.y = this.groundY;
      }

      if (this.bikeGlow) {
        const center = this.player.getCenter();
        this.bikeGlow.setPosition(center.x, center.y);
        this.bikeGlow.angle = this.player.angle;
      }

      if (this.tube) {
        this.tube.setPosition(40, h / 2 + 50);
        const tubeTargetH = h * 0.49;
        this.tube.setDisplaySize(tubeTargetH * (this.tube.width / this.tube.height), tubeTargetH);
      }

      // Reposition end screen elements on resize
      if (this.endCreditsImg) {
        this.endCreditsImg.setPosition(w / 2, h / 2);
        this.endCreditsImg.setDisplaySize(w, h);
      }
      const btnSpacing = Math.min(w * 0.15, 150);
      if (this.endBtnText) {
        this.endBtnText.setPosition(w / 2 - btnSpacing, h * 0.8);
        if (this.endBtnBg) this.endBtnBg.setPosition(this.endBtnText.x, this.endBtnText.y);
      }
      if (this.skipBtnText) {
        this.skipBtnText.setPosition(w / 2 + btnSpacing, h * 0.8);
        if (this.skipBtnBg) this.skipBtnBg.setPosition(this.skipBtnText.x, this.skipBtnText.y);
      }
    }

    setupInput() {
      this.input.on("pointerdown", () => {
        if (!this.running) return;
        if (this.wheelieTime <= 0) {
          this.wheelieTime = WHEELIE_DURATION;
        }
      });
      if (startBtn) startBtn.addEventListener("click", () => this.startGame());
    }

    resetGameState() {
      this.score = 0;
      this.lives = 3;
      this.wheelieTime = 0;
      this.nextSpawnTimer = 0;
      if (this.ingredients) this.ingredients.clear(true, true);
      if (this.enemies) this.enemies.clear(true, true);

      // Destroy Phaser end screen elements if they exist
      this.hideEndScreen();

      if (this.player) {
        this.player.x = this.scale.width * 0.18 + 60;
        this.player.y = this.groundY;
        this.player.angle = 0;
        this.player.setVisible(true);
        this.player.play("bike_anim", true);
      }
      if (this.bikeGlow) {
        const center = this.player.getCenter();
        this.bikeGlow.x = center.x;
        this.bikeGlow.y = center.y;
        this.bikeGlow.setVisible(false);
        this.bikeGlow.setAlpha(0);
      }
      if (this.dust) {
        this.dust.setVisible(false);
      }
      if (this.bg) {
        this.bg.setVisible(true);
      }
      this.updateHud("Tap anywhere to wheelie");
    }

    startGame() {
      if (overlay) overlay.style.display = "none";
      if (hudEl) hudEl.style.display = "flex";

      // Request fullscreen using Phaser's scale manager (more robust for mobile)
      if (this.scale.fullscreenSupported) {
        this.scale.startFullscreen();
      } else {
        // Fallback for browsers with restricted Fullscreen API (like some iOS versions)
        const el = document.documentElement;
        const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
        if (rfs) rfs.call(el).catch(() => {});
      }

      this.resetGameState();
      this.running = true;

      if (this.victorySound) this.victorySound.stop();

      if (this.motorcycleSound) {
        this.motorcycleSound.play();
      }
    }

    showEndScreen(won) {
      const w = this.scale.width;
      const h = this.scale.height;

      // Full screen end credits image
      this.endCreditsImg = this.add.image(w / 2, h / 2, "end_credits");
      this.endCreditsImg.setDisplaySize(w, h);
      this.endCreditsImg.setDepth(100);
      this.endCreditsImg.setAlpha(0);

      // Buttons container or positioning
      const btnFontSize = Math.max(16, Math.round(w * 0.02));
      const padX = btnFontSize * 2;
      const padY = btnFontSize * 1.2;

      // "Play Again" button
      const btnSpacing = Math.min(w * 0.15, 150);
      this.endBtnText = this.add.text(w / 2 - btnSpacing, h * 0.8, "PLAY AGAIN", {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: btnFontSize + "px",
        fontStyle: "bold",
        color: "#ffffff",
        align: "center",
        stroke: '#000000',
        strokeThickness: 4
      });
      this.endBtnText.setOrigin(0.5);
      this.endBtnText.setDepth(104);
      this.endBtnText.setAlpha(0);

      this.endBtnBg = this.add.rectangle(
        this.endBtnText.x, this.endBtnText.y,
        this.endBtnText.width + padX,
        this.endBtnText.height + padY,
        0xc6422c
      );
      this.endBtnBg.setOrigin(0.5);
      this.endBtnBg.setDepth(103);
      this.endBtnBg.setAlpha(0);
      this.endBtnBg.setInteractive({ useHandCursor: true });
      this.endBtnBg.on("pointerover", () => this.endBtnBg.setFillStyle(0xa83520));
      this.endBtnBg.on("pointerout", () => this.endBtnBg.setFillStyle(0xc6422c));
      this.endBtnBg.on("pointerdown", () => this.startGame());

      // "Skip" button
      this.skipBtnText = this.add.text(w / 2 + btnSpacing, h * 0.8, "SKIP", {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: btnFontSize + "px",
        fontStyle: "bold",
        color: "#ffffff",
        align: "center",
        stroke: '#000000',
        strokeThickness: 4
      });
      this.skipBtnText.setOrigin(0.5);
      this.skipBtnText.setDepth(104);
      this.skipBtnText.setAlpha(0);

      this.skipBtnBg = this.add.rectangle(
        this.skipBtnText.x, this.skipBtnText.y,
        this.skipBtnText.width + padX,
        this.skipBtnText.height + padY,
        0x444444
      );
      this.skipBtnBg.setOrigin(0.5);
      this.skipBtnBg.setDepth(103);
      this.skipBtnBg.setAlpha(0);
      this.skipBtnBg.setInteractive({ useHandCursor: true });
      this.skipBtnBg.on("pointerover", () => this.skipBtnBg.setFillStyle(0x666666));
      this.skipBtnBg.on("pointerout", () => this.skipBtnBg.setFillStyle(0x444444));
      this.skipBtnBg.on("pointerdown", () => {
        window.location.href = "https://www.emamiltd.in/brands/smart-and-handsome/";
      });

      // Fade in everything together
      const fadeTargets = [this.endCreditsImg, this.endBtnBg, this.endBtnText, this.skipBtnBg, this.skipBtnText];

      this.tweens.add({
        targets: fadeTargets,
        alpha: 1,
        duration: 800
      });
    }

    hideEndScreen() {
      if (this.endCreditsImg) { this.endCreditsImg.destroy(); this.endCreditsImg = null; }
      if (this.endCreditsBox) { this.endCreditsBox.destroy(); this.endCreditsBox = null; }
      if (this.endBtnBg) { this.endBtnBg.destroy(); this.endBtnBg = null; }
      if (this.endBtnText) { this.endBtnText.destroy(); this.endBtnText = null; }
      if (this.skipBtnBg) { this.skipBtnBg.destroy(); this.skipBtnBg = null; }
      if (this.skipBtnText) { this.skipBtnText.destroy(); this.skipBtnText = null; }

      // Hide lottie container if it's active
      if (lottieContainer) {
        lottieContainer.style.display = "none";
        lottieContainer.innerHTML = "";
      }
    }

    playWinCelebration(callback) {
      if (!lottieContainer || typeof lottie === "undefined") {
        callback();
        return;
      }

      lottieContainer.style.display = "block";
      const anim = lottie.loadAnimation({
        container: lottieContainer,
        renderer: "svg",
        loop: true,
        autoplay: true,
        path: "assets/animations/Confetti - Full Screen.json"
      });

      // Show for 5 seconds then callback
      this.time.delayedCall(5000, () => {
        anim.destroy();
        lottieContainer.style.display = "none";
        lottieContainer.innerHTML = "";
        callback();
      });
    }

    updateHud(msg) {
      if (scoreEl) {
        const oldScore = parseInt(scoreEl.textContent);
        scoreEl.textContent = this.score;
        if (oldScore !== this.score) this.triggerPulse(scoreEl.parentElement);
      }
      if (livesEl) {
        const oldLives = parseInt(livesEl.textContent);
        livesEl.textContent = this.lives;
        if (oldLives !== this.lives) this.triggerPulse(livesEl.parentElement);
      }
      if (msg && stateEl) {
        stateEl.textContent = msg.toUpperCase();
      }
    }

    triggerPulse(element) {
      if (!element) return;
      element.classList.remove("hud-pulse");
      void element.offsetWidth; // Trigger reflow
      element.classList.add("hud-pulse");
    }

    /** Show a floating text that rises and fades out above the player */
    showFloatingText(label) {
      const x = this.player.x + BIKE_DISPLAY_W * 0.3;
      const y = this.player.y - BIKE_DISPLAY_H - 10;

      const txt = this.add.text(x, y, label, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: Math.max(16, Math.round(this.scale.width * 0.014) + 4) + "px",
        color: "#38bdf8",
        stroke: "#0c1a2e",
        strokeThickness: 3,
        align: "center",
      });
      txt.setOrigin(0.5, 1);
      txt.setDepth(50);

      this.tweens.add({
        targets: txt,
        y: y - 60,
        alpha: 0,
        duration: 900,
        ease: "Cubic.easeOut",
        onComplete: () => txt.destroy(),
      });
    }

    /** Make the player blink when hit */
    blinkPlayer() {
      if (!this.player) return;
      this.tweens.add({
        targets: this.player,
        alpha: 0.2,
        duration: 100,
        yoyo: true,
        repeat: 5,
        onComplete: () => {
          if (this.player) this.player.setAlpha(1);
        }
      });
    }

    triggerPickGlow() {
      if (!this.bikeGlow) return;
      this.bikeGlow.setVisible(true);
      this.bikeGlow.setAlpha(0);
      
      this.tweens.add({
        targets: this.bikeGlow,
        alpha: 1,
        duration: 200,
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          if (this.bikeGlow) {
            this.bikeGlow.setVisible(false);
            this.bikeGlow.setAlpha(0);
          }
        }
      });
    }

    spawnIngredient() {
      const type = Math.random() < 0.5 ? "niancinamide" : "methanol";
      const sz = (60 + Math.random() * 20) * 1.3; // Increased by 30%
      const y = this.groundY - sz / 2 + 5; // Sit on the ground (adjusted for center origin)

      if (type === "niancinamide") {
        const container = this.add.container(this.scale.width + 80, y);
        
        const glow = this.add.image(0, 0, "methanol_glow");
        glow.setDisplaySize(sz * 2.5, sz * 2.5);
        glow.setAlpha(0.6);
        glow.setTint(0x7ce3b1); // Greenish tint for niancinamide
        
        this.tweens.add({
          targets: glow,
          alpha: 0.2,
          scale: (sz * 1.8) / 4524,
          duration: 1200,
          yoyo: true,
          repeat: -1
        });

        const sp = this.add.sprite(0, 0, "niancinamide");
        sp.setDisplaySize(sz, sz);
        sp.play("niancinamide_anim");
        
        container.add([glow, sp]);
        container.pickupType = "niancinamide";
        container.sz = sz;
        this.ingredients.add(container);
      } else {
        // Methanol with pulsating glow
        const container = this.add.container(this.scale.width + 80, y + 30);
        
        const glow = this.add.image(0, 0, "methanol_glow");
        glow.setDisplaySize(sz * 3, sz * 3);
        glow.setAlpha(0.7);
        
        // Pulsate glow
        this.tweens.add({
          targets: glow,
          alpha: 0.3,
          scale: (sz * 2) / 4524, // Using pixelWidth found earlier
          duration: 1000,
          yoyo: true,
          repeat: -1
        });

        const mImg = "methanol_" + (Math.floor(Math.random() * 3) + 1);
        const sp = this.add.image(0, 0, mImg);
        sp.setDisplaySize(sz, sz);
        
        container.add([glow, sp]);
        container.pickupType = "methanol";
        container.sz = sz;
        this.ingredients.add(container);
      }
    }

    spawnEnemy() {
      const sz = 60 + Math.random() * 20;
      const sp = this.add.sprite(this.scale.width + 120, this.groundY, "virus");
      sp.setOrigin(0.5, 1);
      sp.setDisplaySize(sz, sz);
      sp.play("virus_anim");
      sp.dead = false;
      this.enemies.add(sp);
    }

    update(_t, delta) {
      if (!this.running) return;
      const dt = delta / 1000;

      this.bg.tilePositionX += this.worldSpeed * dt;

      if (this.wheelieTime > 0) this.wheelieTime -= dt;
      const wh = this.wheelieTime > 0;

      this.player.angle = Phaser.Math.Linear(
        this.player.angle,
        wh ? WHEELIE_ANGLE : 0,
        8 * dt
      );

      if (this.bikeGlow) {
        const center = this.player.getCenter();
        this.bikeGlow.setPosition(center.x, center.y);
        this.bikeGlow.angle = this.player.angle;
      }

      // Dust logic
      if (wh && this.running) {
        this.dust.setVisible(true);
        this.dust.x = this.player.x + 10; // Slightly offset from the exact wheel contact
        this.dust.y = this.groundY + 30; // Adjusted down by 100px as requested
        if (!this.dust.anims.isPlaying) this.dust.play("dust_anim");
      } else {
        this.dust.setVisible(false);
        this.dust.stop();
      }

      this.nextSpawnTimer -= dt;
      if (this.nextSpawnTimer <= 0) {
        if (Math.random() < 0.35) {
          this.spawnEnemy();
        } else {
          this.spawnIngredient();
        }
        // Random distance: at least 1.1s (about 350px) to 2.0s between spawns
        this.nextSpawnTimer = 1.1 + Math.random() * 0.9;
      }

      const mv = this.worldSpeed * dt;
      this.ingredients.getChildren().forEach(i => { i.x -= mv; });
      this.enemies.getChildren().forEach(e => { e.x -= mv * 1.05; });

      const box = {
        x: this.player.x - BIKE_DISPLAY_W * 0.15,
        y: this.player.y,
        width: BIKE_DISPLAY_W,
        height: wh ? BIKE_DISPLAY_H * 1.4 : BIKE_DISPLAY_H,
      };

      const hitEnemy = (b, o, s) => {
        const ox = (o.originX === 0.5) ? o.x - s/2 : o.x;
        const oy = (o.originY === 1) ? o.y - s : o.y;
        return b.x < ox + s && b.x + b.width > ox &&
               b.y - b.height < oy + s && b.y > oy;
      };

      const hitPickup = (b, o, sz) => {
        const ox = (o.type === "Container" || o.originX === 0.5) ? o.x - sz/2 : o.x;
        const oy = (o.type === "Container" || o.originY === 0.5) ? o.y - sz/2 : o.y;
        return b.x < ox + sz && b.x + b.width > ox &&
               b.y - b.height < oy + sz && b.y > oy;
      };

      this.ingredients.getChildren().forEach(i => {
        if (i.collected) return;
        const s = i.type === "Container" ? i.sz : i.displayWidth;

        if (hitPickup(box, i, s)) {
          const pType = i.pickupType || "ingredient";
          const displayName = pType === "niancinamide" ? "Niacinamide" : "Methanol";
          i.collected = true; 
          i.destroy();
          this.score += 1;
          this.updateHud("Nice pick-up!");
          this.showFloatingText("+1 " + displayName);
          this.triggerPickGlow();
          if (this.coinSound) this.coinSound.play();
        }
      });

      this.enemies.getChildren().forEach(e => {
        if (e.dead) return;
        const s = e.displayWidth;
        if (hitEnemy(box, e, s)) {
          e.dead = true;
          // Spawn explosion at enemy position
          const exp = this.add.sprite(e.x, e.y - s/2, "explosion");
          exp.setScale(s / 150); // Scale explosion relative to enemy size
          exp.play("explode");
          exp.on('animationcomplete', () => exp.destroy());
          
          e.destroy();
          if (wh) {
            this.score += 3;
            this.updateHud("Enemy wiped out!");
          } else {
            this.lives -= 1;
            this.updateHud("Hit! Lost a life.");
            this.blinkPlayer();
            if (this.hitSound) this.hitSound.play();
          }
        }
      });

      this.ingredients.getChildren().forEach(i => { if (i.x < -80) i.destroy(); });
      this.enemies.getChildren().forEach(e => { if (e.x < -80) e.destroy(); });

      // End Game Conditions
      if (this.lives <= 0 || this.score >= 40) {
        this.running = false;
        if (this.motorcycleSound) {
          this.motorcycleSound.stop();
        }

        const won = this.score >= 40;
        this.updateHud(won ? "You Won!" : "Game Over");
        if (hudEl) hudEl.style.display = "none";

        if (this.player) {
          this.player.stop();
        }
        if (this.bikeGlow) {
          this.bikeGlow.setVisible(false);
        }

        // Keep game objects visible but stop movement
        if (this.ingredients) this.ingredients.clear(true, true);
        if (this.enemies) this.enemies.clear(true, true);
        if (this.dust) {
          this.dust.setVisible(false);
          this.dust.stop();
        }

        if (won) {
          if (this.victorySound) this.victorySound.play();
          this.playWinCelebration(() => {
            this.showEndScreen(true);
          });
        } else {
          this.showEndScreen(false);
        }
      }
    }
  }

  /* ---------- Phaser ---------- */
  new Phaser.Game({
    type: Phaser.CANVAS,
    scale: {
      mode: Phaser.Scale.RESIZE,
      parent: "game-container",
      width: "100%",
      height: "100%",
      autoCenter: Phaser.Scale.CENTER_BOTH,
      fullscreenTarget: "game-wrap"
    },
    scene: [MainScene],
    fps: { target: 60 },
  });
})();
