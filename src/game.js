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
  const energyBarFill = document.getElementById("energy-bar");

  /* ---------- Orientation enforcement ---------- */
  function checkOrientation() {
    // If in portrait mode, force landscape via CSS rotation
    if (window.innerHeight > window.innerWidth) {
      gameWrap.classList.add("force-landscape");
    } else {
      gameWrap.classList.remove("force-landscape");
    }
    /*
    // Always hide the rotate prompt as we are handling it by forcing landscape
    rotatePrompt.style.display = "none";
    */
    if (window.innerHeight > window.innerWidth) {
        rotatePrompt.style.display = "flex";
        gameWrap.classList.add("force-landscape");
    } else {
        rotatePrompt.style.display = "none";
        gameWrap.classList.remove("force-landscape");
    }
    
    // Refresh Phaser scale to match new dimensions
    setTimeout(() => {
        window.scrollTo(0, 0);
        if (window.game) {
          window.game.scale.refresh();
        }
        window.dispatchEvent(new Event("resize"));
    }, 200);
  }

  window.addEventListener("load", checkOrientation);
  window.addEventListener("resize", checkOrientation);
  window.addEventListener("orientationchange", function () {
    setTimeout(checkOrientation, 100);
    // Force browser to re-check dimensions and fire resize for Phaser
    setTimeout(() => {
      window.scrollTo(0, 0);
      window.dispatchEvent(new Event("resize"));
    }, 500);
  });

  /* ---------- Constants ---------- */
  const BIKE_DISPLAY_W = 197;
  const BIKE_DISPLAY_H = 140;
  const LASER_SPEED = 1000;
  const SHOOT_COOLDOWN = 75; // ms (Reduced by 50% from 150)
  const SHOOT_ENERGY_COST = 34;
  const ENERGY_RECHARGE_RATE = 20; // per second
  const MAX_ENERGY = 34; // Reduced by 2 shots (was 100, now allows only 1 shot)
  const ingredientsPalette = ["#f8d15b", "#6fd3f2", "#f48fa6", "#7ce3b1"];

  /* ---------- Scene ---------- */
  class MainScene extends Phaser.Scene {
    constructor() {
      super("MainScene");
      this.player = null;
      this.bg = null;
      this.ingredients = null;
      this.enemies = null;
      this.lasers = null;
      this.lastShootTime = 0;
      this.score = 0;
      this.lives = 2;
      this.energy = MAX_ENERGY;
      this.nextSpawnTimer = 0;
      this.worldSpeed = 455;
      this.running = false;
      this.waitingToStart = false;
      this.groundY = 0;
      this.darkOverlay = null; // For start screen
      this.endOverlay = null;  // For end screen
    }

    preload() {
      this.load.on("loaderror", (file) => {
        console.error("Failed to load asset:", file.key, file.url);
      });

      this.load.spritesheet("bike", "assets/Images/Modern-bike-game/Bike_Idle.png", {
        frameWidth: 366,
        frameHeight: 260
      });
      this.load.image("bike_glow_new", "assets/Images/Modern-bike-game/Bike-Glow-New.png");
      this.load.image("bg", "assets/Images/Modern-bike-game/Bg_new.png");
      this.load.audio("motorcycle", "assets/sounds/bike-sound-edited.mp3");
      this.load.audio("hit_sound", "assets/sounds/hit.mp3");
      this.load.audio("coin_sound", "assets/sounds/coin.mp3");
      this.load.audio("victory_sound", "assets/sounds/Victory.mp3");
      this.load.audio("laser_sound", "assets/sounds/laser.mp3");
      this.load.audio("destroy_sound", "assets/sounds/Destroy.mp3");
      this.load.image("explosion", "assets/Images/Modern-bike-game/Blast_new.png");
      this.load.spritesheet("bike_dust", "assets/Images/Bike-Dust.png", {
        frameWidth: 480,
        frameHeight: 436
      });
      
      // New Pickups
      this.load.image("niancinamide", "assets/Images/Modern-bike-game/Niancinamide_2.png");
      this.load.image("b12", "assets/Images/Modern-bike-game/B12_2.png");
      this.load.image("methanol_glow", "assets/Images/Methanol _glow_gradient.png");
      this.load.image("virus", "assets/Images/Modern-bike-game/Enemy_Virus.png");
      this.load.image("virus_glow", "assets/Images/Modern-bike-game/Enemy_Glow.png");

      this.load.image("end_credits", "assets/Images/End_Credits.jpeg");
      this.load.image("end_instructions", "assets/Images/Modern-bike-game/End_Instructions.png");
      this.load.image("start_instructions", "assets/Images/Modern-bike-game/Start_Instructions_New.png");
      this.load.image("start_btn", "assets/Images/Modern-bike-game/Start_btn.png");
      this.load.image("sah_logo", "assets/Images/SAH_LOGO.png");
      this.load.image("tube", "assets/Images/S&H_Tube.png");
    }

    create() {
      const w = this.scale.width;
      const h = this.scale.height;
      this.groundY = Math.round(h * 0.845) + 7 - 30;

      this.motorcycleSound = this.sound.add("motorcycle", { loop: true, volume: 0.2 });
      this.hitSound = this.sound.add("hit_sound", { volume: 0.5 });
      this.coinSound = this.sound.add("coin_sound", { volume: 0.5 });
      this.victorySound = this.sound.add("victory_sound", { volume: 0.6 });
      this.laserSound = this.sound.add("laser_sound", { volume: 0.4 });
      this.destroySound = this.sound.add("destroy_sound", { volume: 0.6 });

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
        // Dynamically slice the explosion image into 5 frames (1 row, 5 cols)
        const texture = this.textures.get("explosion");
        if (texture && texture.source[0]) {
          const imgW = texture.source[0].width;
          const imgH = texture.source[0].height;
          const frameW = imgW / 5;
          const frameH = imgH;
          
          const frames = [];
          for (let i = 0; i < 5; i++) {
            // Add frame if it doesn't exist (using numeric keys 0-4)
            if (!texture.has(i)) {
              texture.add(i, 0, i * frameW, 0, frameW, frameH);
            }
            frames.push({ key: "explosion", frame: i });
          }

          this.anims.create({
            key: "explode",
            frames: frames,
            frameRate: 20,
            repeat: 0
          });
        }
      }

      if (!this.anims.exists("dust_anim")) {
        this.anims.create({
          key: "dust_anim",
          frames: this.anims.generateFrameNumbers("bike_dust", { start: 0, end: 12 }),
          frameRate: 20,
          repeat: -1
        });
      }

      if (!this.anims.exists("bike_anim")) {
        this.anims.create({
          key: "bike_anim",
          frames: this.anims.generateFrameNumbers("bike", { start: 0, end: 4 }),
          frameRate: 15,
          repeat: -1
        });
      }

      this.bg = this.add.tileSprite(0, 0, w || 1280, h || 720, "bg");
      this.bg.setOrigin(0, 0);
      this.bg.setDepth(-1);
      const bgScale = Math.max((w || 1280) / 6000, (h || 720) / 805) * 2;
      this.bg.tileScaleX = bgScale;
      this.bg.tileScaleY = bgScale;

      // Dark Overlay for Welcome Screen
      this.darkOverlay = this.add.rectangle(0, 0, w, h, 0x000000, 0.85);
      this.darkOverlay.setOrigin(0, 0);
      this.darkOverlay.setDepth(210); // Above bike (200)
      this.darkOverlay.setVisible(true);

      this.player = this.add.sprite((w || 1280) * 0.18 - 50, this.groundY, "bike");
      this.player.setOrigin(0.15, 0.95);
      this.player.setDepth(200);
      this.player.displayWidth = BIKE_DISPLAY_W;
      this.player.displayHeight = BIKE_DISPLAY_H;
      this.player.play("bike_anim");

      this.bikeGlow = this.add.image(this.player.x, this.player.y, "bike_glow_new");
      this.bikeGlow.setOrigin(0.5, 0.5); 
      this.bikeGlow.setDepth(201); 
      const glowScale = 415 / BIKE_DISPLAY_H;
      this.bikeGlow.displayWidth = BIKE_DISPLAY_W * glowScale * 0.8; // Reduced width by 20%
      this.bikeGlow.displayHeight = 415;
      this.bikeGlow.setAlpha(0);
      this.bikeGlow.setVisible(false);

      this.dust = this.add.sprite(0, 0, "bike_dust");
      this.dust.setOrigin(1, 0.95);
      this.dust.setDepth(5); // Behind bike
      this.dust.setVisible(false);
      this.dust.play("dust_anim");
      this.dust.setScale(0.4);

      // Start Instructions & Button
      this.startInstructions = this.add.image(w / 2, h / 2, "start_instructions");
      this.startInstructions.setDepth(220);
      this.startInstructions.setVisible(true);

      this.startBtn = this.add.image(w / 2, h / 2, "start_btn");
      this.startBtn.setDepth(225);
      this.startBtn.setVisible(true);
      this.startBtn.setInteractive({ useHandCursor: true });
      this.startBtn.on("pointerdown", () => {
        if (!this.running) {
          this.startGame();
          this.startClickTime = 0; // Bypass debounce
          this.shoot();
        } else if (this.waitingToStart) {
          this.shoot();
        }
      });


      // --- OBJECT POOLING ---
      this.ingredients = this.add.group();
      this.enemies = this.add.group();
      this.lasers = this.add.group();
      this.explosions = this.add.group();

      this.preWarmPools();

      this.scale.on("resize", this.onResize, this);

      this.resetGameState();
      this.onResize(this.scale.gameSize);
      this.setupInput();
      this.running = false;
    }

    preWarmPools() {
      // Pre-create 6 ingredients
      for (let i = 0; i < 6; i++) {
        this.spawnIngredient();
      }
      this.ingredients.getChildren().forEach(item => item.setActive(false).setVisible(false));

      // Pre-create 6 enemies
      for (let i = 0; i < 6; i++) {
        this.spawnEnemy();
      }
      this.enemies.getChildren().forEach(enemy => enemy.setActive(false).setVisible(false));

      // Pre-create 12 lasers
      for (let i = 0; i < 12; i++) {
        const laser = this.add.rectangle(0, 0, 56, 7, 0x00f2ff);
        const glow = this.add.rectangle(0, 0, 70, 14, 0x00f2ff, 0.3);
        const lObj = this.add.container(-100, -100);
        lObj.add([glow, laser]);
        lObj.setDepth(1000);
        lObj.setActive(false).setVisible(false);
        this.lasers.add(lObj);
      }

      // Pre-create 6 explosions
      for (let i = 0; i < 6; i++) {
        const exp = this.add.sprite(-100, -100, "explosion");
        exp.setActive(false).setVisible(false);
        this.explosions.add(exp);
      }
    }

    onResize(gameSize) {
      const w = gameSize.width;
      const h = gameSize.height;
      if (w <= 0 || h <= 0) return;

      this.groundY = Math.round(h * 0.845) + 12 - 30;

      if (this.bg) {
        this.bg.setSize(w, h);
        const s = Math.max(w / 6000, h / 805) * 2;
        this.bg.tileScaleX = s;
        this.bg.tileScaleY = s;
      }
      if (this.darkOverlay) {
        this.darkOverlay.setSize(w, h);
      }

      if (this.player) {
        this.player.x = w * 0.18 - 50;
        this.player.y = this.groundY;
      }

      if (this.bikeGlow) {
        this.bikeGlow.setPosition(
          this.player.x + BIKE_DISPLAY_W * 0.35,
          this.player.y - BIKE_DISPLAY_H * 0.45
        );
        this.bikeGlow.angle = this.player.angle;
      }

      // Start Instructions Positioning
      if (this.startInstructions) {
        this.startInstructions.setPosition(w / 2 + 50, h * 0.45 + 50);
        // Original logic was fitting to screen. User specified 637.05 x 372.
        // We'll maintain scaling logic but ensure it respects these proportions by using the texture's aspect ratio.
        // Phaser uses texture dims by default.
        // We ensure it fits within 85% width and 55% height to leave room.
        // Reduced by another 10% (1.51 * 0.9 = 1.36)
        const s = Math.min((w * 0.85) / this.startInstructions.width, (h * 0.55) / this.startInstructions.height) * 1.36;
        this.startInstructions.setScale(s);

        if (this.startBtn) {
          const instrHalfHeight = (this.startInstructions.height * s) / 2;
          const instrBottom = this.startInstructions.y + instrHalfHeight;
          this.startBtn.setPosition(w / 2 + 10, instrBottom + h * 0.08 - 80);
          
          const btnScale = Math.min(w * 0.35 / this.startBtn.width, h * 0.12 / this.startBtn.height);
          this.startBtn.setScale(btnScale);
        }
      }

      // Reposition end screen elements on resize
      if (this.endCreditsImg) {
        this.endCreditsImg.setPosition(w / 2, h / 2);
        this.endCreditsImg.setDisplaySize(w, h);
      }
      if (this.endOverlay) {
        this.endOverlay.setSize(w, h);
        this.endOverlay.setPosition(w / 2, h / 2); // Rectangle origin is 0.5,0.5 for endOverlay? Check creation.
        // Created with x, y = w/2, h/2. Origin default is 0.5, 0.5 for Rectangle in Phaser 3?
        // Actually factory add.rectangle defaults origin to 0.5.
        // In create I used setOrigin(0,0) for darkOverlay.
        // In showEndScreen I used defaults (0.5).
      }

      if (this.visitBtnText) {
        this.visitBtnText.setPosition(w / 2, h * 0.8);
        if (this.visitBtnBg) this.visitBtnBg.setPosition(this.visitBtnText.x, this.visitBtnText.y);
      }
    }

    setupInput() {
      this.input.on("pointerdown", () => {
        if (!this.running) return;
        this.shoot();
      });
      if (startBtn) startBtn.addEventListener("click", () => this.startGame());
    }

    shoot() {
      if (this.waitingToStart) {
        // Prevent immediate start from the same click
        if (this.time.now - (this.startClickTime || 0) < 200) return;

        this.waitingToStart = false;

        // Request fullscreen on first tap
        if (this.scale.fullscreenSupported) {
          this.scale.startFullscreen();
        }

        if (this.motorcycleSound) {
          this.motorcycleSound.play();
        }
        
        // Hide Start Instructions and Button
        if (this.startInstructions) {
          this.startInstructions.setVisible(false);
          this.startInstructions.setAlpha(0);
        }
        if (this.startBtn) {
          this.startBtn.setVisible(false);
        }
        
        // Fade out dark overlay
        if (this.darkOverlay) {
          this.tweens.add({
            targets: this.darkOverlay,
            alpha: 0,
            duration: 500,
            onComplete: () => {
              if (this.darkOverlay) this.darkOverlay.setVisible(false);
            }
          });
        }

        this.updateHud("Go!");
        return;
      }

      const now = this.time.now;
      if (now - this.lastShootTime < SHOOT_COOLDOWN) return;
      if (this.energy < SHOOT_ENERGY_COST) {
        this.updateHud("Out of energy!");
        return;
      }
      
      this.lastShootTime = now;
      this.energy -= SHOOT_ENERGY_COST;
      this.updateEnergyBar();
      if (this.laserSound) this.laserSound.play();

      const px = this.player.x + 60;
      const py = this.player.y - 45;

      // Create/Get two lasers
      for (let i = 0; i < 2; i++) {
        const offset = i === 0 ? -20 : 20;
        
        // Try to get from group
        let lObj = this.lasers.getFirstDead(false);
        if (!lObj) {
          // If not in group, create it
          const laser = this.add.rectangle(0, 0, 56, 7, 0x00f2ff);
          const glow = this.add.rectangle(0, 0, 70, 14, 0x00f2ff, 0.3);
          lObj = this.add.container(px, py + offset);
          lObj.add([glow, laser]);
          lObj.setDepth(1000);
          this.lasers.add(lObj);
        } else {
          lObj.setPosition(px, py + offset);
          lObj.setActive(true).setVisible(true);
        }
      }
    }

    resetGameState() {
      this.score = 0;
      this.lives = 2;
      this.energy = MAX_ENERGY;
      this.updateEnergyBar();
      this.lastShootTime = 0;
      this.nextSpawnTimer = 1; // Spawning will start 1s after first tap
      if (this.ingredients) this.ingredients.clear(true, true);
      if (this.enemies) this.enemies.clear(true, true);
      if (this.lasers) this.lasers.clear(true, true);
      if (this.explosions) this.explosions.clear(true, true);

      // Destroy Phaser end screen elements if they exist
      this.hideEndScreen();

      if (this.player) {
        this.player.x = this.scale.width * 0.18 - 50;
        this.player.y = this.groundY;
        this.player.angle = 0;
        this.player.setVisible(true);
        this.player.play("bike_anim", true);
      }
      if (this.bikeGlow) {
        this.bikeGlow.setPosition(
          this.player.x + BIKE_DISPLAY_W * 0.35,
          this.player.y - BIKE_DISPLAY_H * 0.45
        );
        this.bikeGlow.setVisible(false);
        this.bikeGlow.setAlpha(0);
      }
      
      if (this.dust) {
        this.dust.setVisible(false);
      }
      if (this.bg) {
        this.bg.setVisible(true);
      }
      
      // Show Start Instructions and Button
      if (this.startInstructions) {
        this.startInstructions.setVisible(true);
        this.startInstructions.setAlpha(1);
      }
      if (this.startBtn) {
        this.startBtn.setVisible(true);
      }
      // Show Dark Overlay
      if (this.darkOverlay) {
        this.darkOverlay.setVisible(true);
        this.darkOverlay.setAlpha(0.85);
      }

      this.updateHud("Tap anywhere to start");
    }

    startGame() {
      if (overlay) overlay.style.display = "none";
      if (hudEl) hudEl.style.display = "flex";

      this.resetGameState();
      this.running = true;
      this.waitingToStart = true;
      this.startClickTime = this.time.now; // Record when they clicked start


      if (this.victorySound) this.victorySound.stop();
    }

    showEndScreen(won) {
      const w = this.scale.width;
      const h = this.scale.height;

      // End Screen Overlay
      this.endOverlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.85);
      this.endOverlay.setDepth(350);
      this.endOverlay.setAlpha(0);

      // Full screen end credits image
      this.endCreditsImg = this.add.image(w / 2, h / 2, "end_credits");
      this.endCreditsImg.setDisplaySize(w, h);
      this.endCreditsImg.setDepth(400);
      this.endCreditsImg.setAlpha(0);

      // Buttons container or positioning
      const btnFontSize = Math.max(16, Math.round(w * 0.02));
      const padX = btnFontSize * 2;
      const padY = btnFontSize * 1.2;

      // "Visit Site" button
      this.visitBtnText = this.add.text(w / 2, h * 0.8, "VISIT SITE", {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: btnFontSize + "px",
        fontStyle: "bold",
        color: "#ffffff",
        align: "center",
        stroke: '#000000',
        strokeThickness: 4
      });
      this.visitBtnText.setOrigin(0.5);
      this.visitBtnText.setDepth(404);
      this.visitBtnText.setAlpha(0);

      this.visitBtnBg = this.add.rectangle(
        this.visitBtnText.x, this.visitBtnText.y,
        this.visitBtnText.width + padX,
        this.visitBtnText.height + padY,
        0xc6422c
      );
      this.visitBtnBg.setOrigin(0.5);
      this.visitBtnBg.setDepth(403);
      this.visitBtnBg.setAlpha(0);
      this.visitBtnBg.setInteractive({ useHandCursor: true });
      this.visitBtnBg.on("pointerover", () => this.visitBtnBg.setFillStyle(0xa83520));
      this.visitBtnBg.on("pointerout", () => this.visitBtnBg.setFillStyle(0xc6422c));
      this.visitBtnBg.on("pointerdown", () => {
        window.location.href = "https://www.emamiltd.in/brands/smart-and-handsome/";
      });

      // Fade in everything together
      const fadeTargets = [this.endCreditsImg, this.visitBtnBg, this.visitBtnText, this.endOverlay];

      this.tweens.add({
        targets: fadeTargets,
        alpha: 1,
        duration: 800
      });
    }

    hideEndScreen() {
      if (this.endOverlay) { this.endOverlay.destroy(); this.endOverlay = null; }
      if (this.endCreditsImg) { this.endCreditsImg.destroy(); this.endCreditsImg = null; }
      if (this.endCreditsBox) { this.endCreditsBox.destroy(); this.endCreditsBox = null; }
      if (this.visitBtnBg) { this.visitBtnBg.destroy(); this.visitBtnBg = null; }
      if (this.visitBtnText) { this.visitBtnText.destroy(); this.visitBtnText = null; }

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

      const w = this.scale.width;
      const h = this.scale.height;

      // Dark Overlay for End Instructions
      const celebrationOverlay = this.add.rectangle(0, 0, w, h, 0x000000, 0.85);
      celebrationOverlay.setOrigin(0, 0);
      celebrationOverlay.setDepth(999); // Below instructions (1000)
      celebrationOverlay.setAlpha(0);

      // Show end instructions during celebration
      const endInstr = this.add.image(w / 2, h / 2 + 50, "end_instructions");
      // Increased by 50% from 0.84 -> 1.26
      const instrScale = Math.min((w * 0.8) / endInstr.width, (h * 0.7) / endInstr.height) * 1.26;
      endInstr.setScale(instrScale);
      endInstr.setDepth(1000);
      endInstr.setAlpha(0);

      // Add tube image to the right of end instructions
      const tube = this.add.image(
        w / 2 + (endInstr.width * instrScale) / 2,
        h / 2 + 50,
        "tube"
      );
      // Scale tube relative to instructions (reduced by 20% from 0.56 -> 0.448)
      const tubeScale = instrScale * 0.448; 
      tube.setScale(tubeScale);
      tube.setAngle(16);
      tube.setDepth(1001);
      tube.setAlpha(0);
      // Offset slightly to the right so it's "right most"
      tube.x += (tube.width * tubeScale) * 0.3 - 20;

      // Add logo on top of end instructions
      const logo = this.add.image(
        w / 2,
        endInstr.y - (endInstr.height * instrScale) / 2, // Top edge of instructions
        "sah_logo"
      );
      // Scale logo to reasonable width relative to instructions
      // Reduced by another 30% (was 0.28 -> 0.196)
      const logoScale = (endInstr.width * instrScale * 0.196) / logo.width; 
      logo.setScale(logoScale);
      logo.setOrigin(0.5, 0.7); // Bottom-ish anchor so it sits on top edge
      logo.setDepth(1002);
      logo.setAlpha(0);

      this.tweens.add({
        targets: [celebrationOverlay, endInstr, tube, logo],
        alpha: 1,
        duration: 500
      });

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
        
        // Fade out everything before credits
        this.tweens.add({
          targets: [celebrationOverlay, endInstr, tube, logo],
          alpha: 0,
          duration: 500,
          onComplete: () => {
            celebrationOverlay.destroy();
            endInstr.destroy();
            tube.destroy();
            logo.destroy();
            callback();
          }
        });
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

    updateEnergyBar() {
      if (energyBarFill) {
        const percent = (this.energy / MAX_ENERGY) * 100;
        energyBarFill.style.width = percent + "%";
        
        // Change color when low
        if (this.energy < SHOOT_ENERGY_COST) {
          energyBarFill.style.background = "#ff4b2b";
        } else {
          energyBarFill.style.background = "linear-gradient(90deg, #00f2ff, #38bdf8)";
        }
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
      if (!this.bikeGlow || !this.player) return;
      
      this.bikeGlow.setVisible(true);
      this.bikeGlow.setAlpha(0);
      
      // Pulsate the glow for 2 seconds (250ms * 2 (yoyo) * 4 cycles = 2000ms)
      this.tweens.add({
        targets: this.bikeGlow,
        alpha: 1,
        duration: 250,
        yoyo: true,
        repeat: 3,
        onComplete: () => {
          if (this.bikeGlow) {
            this.bikeGlow.setVisible(false);
            this.bikeGlow.setAlpha(0);
          }
        }
      });
    }

    spawnIngredient() {
      const type = Math.random() < 0.5 ? "niancinamide" : "b12";
      const sz = 80 * 1.3 * 2; 
      const y = this.groundY - sz / 2 + 5; 
      const x = this.scale.width + 80;

      let item = this.ingredients.getFirstDead(false);
      if (!item) {
        // Removed methanol_glow_gradient as requested
        
        const sp = this.add.image(0, 0, type);
        sp.setDisplaySize(sz, sz);
        sp.name = "sprite";
        
        item = this.add.container(x, y);
        item.add([sp]);
        this.ingredients.add(item);
      } else {
        item.setPosition(x, y);
        item.setActive(true).setVisible(true);
        // const glow = item.getByName("glow"); // Removed
        const sprite = item.getByName("sprite");
        sprite.setTexture(type);
        sprite.setDisplaySize(sz, sz);
        // glow.setDisplaySize(sz * 2.5, sz * 2.5); // Removed
      }

      item.pickupType = type;
      item.sz = sz;
      item.collected = false;

      // const glow = item.getByName("glow"); // Removed
      // if (type === "niancinamide") {
      //   glow.setTint(0x7ce3b1);
      // } else {
      //   glow.setTint(0x38bdf8);
      // }
    }

    spawnEnemy() {
      // Increased by 50% (was 60 + rand*20)
      const sz = 90 + Math.random() * 30;
      const x = this.scale.width + 120;
      const y = this.groundY - sz / 2;

      let enemy = this.enemies.getFirstDead(false);
      if (!enemy) {
        const glow = this.add.image(0, 0, "virus_glow");
        glow.setDisplaySize(sz * 2.5, sz * 2.5);
        glow.setAlpha(0.5);
        glow.name = "glow";
        
        this.tweens.add({
          targets: glow,
          alpha: 0.2,
          scale: 1.2,
          duration: 800,
          yoyo: true,
          repeat: -1
        });

        const sp = this.add.image(0, 0, "virus");
        sp.setDisplaySize(sz, sz);
        sp.name = "sprite";
        
        enemy = this.add.container(x, y);
        enemy.add([glow, sp]);
        this.enemies.add(enemy);
      } else {
        enemy.setPosition(x, y);
        enemy.setActive(true).setVisible(true);
        const sprite = enemy.getByName("sprite");
        const glow = enemy.getByName("glow");
        sprite.setDisplaySize(sz, sz);
        glow.setDisplaySize(sz * 2.5, sz * 2.5);
      }
      
      enemy.sz = sz;
      enemy.dead = false;
    }

    update(_t, delta) {
      if (!this.running || this.waitingToStart) return;
      const dt = delta / 1000;

      this.bg.tilePositionX += this.worldSpeed * dt;

      // Energy recharge
      if (this.energy < MAX_ENERGY) {
        this.energy = Math.min(MAX_ENERGY, this.energy + ENERGY_RECHARGE_RATE * dt);
        this.updateEnergyBar();
      }

      if (this.bikeGlow) {
        this.bikeGlow.setPosition(
          this.player.x + BIKE_DISPLAY_W * 0.35,
          this.player.y - BIKE_DISPLAY_H * 0.45
        );
        this.bikeGlow.angle = this.player.angle;
      }

      this.nextSpawnTimer -= dt;
      if (this.nextSpawnTimer <= 0) {
        if (Math.random() < 0.35) {
          this.spawnEnemy();
        } else {
          this.spawnIngredient();
        }
        // Random distance: at least 0.9s to 1.5s between spawns for high speed spacing
        this.nextSpawnTimer = 0.9 + Math.random() * 0.6;
      }

      const mv = this.worldSpeed * dt;
      this.ingredients.getChildren().forEach(i => { 
        if (i.active) {
          i.x -= mv; 
          if (i.x < -100) i.setActive(false).setVisible(false);
        }
      });
      this.enemies.getChildren().forEach(e => { 
        if (e.active) {
          e.x -= mv * 1.05; 
          if (e.x < -100) e.setActive(false).setVisible(false);
        }
      });
      
      // Laser movement and cleanup
      this.lasers.getChildren().forEach(l => { 
        if (l.active) {
          l.x += LASER_SPEED * dt; 
          if (l.x > this.scale.width + 100) l.setActive(false).setVisible(false);
        }
      });

      const box = {
        x: this.player.x - BIKE_DISPLAY_W * 0.15,
        y: this.player.y,
        width: BIKE_DISPLAY_W,
        height: BIKE_DISPLAY_H,
      };

      const hitEnemy = (b, o, s) => {
        const ox = (o.type === "Container" || o.originX === 0.5) ? o.x - s/2 : o.x;
        const oy = (o.type === "Container" || o.originY === 0.5) ? o.y - s/2 : (o.originY === 1 ? o.y - s : o.y);
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
        if (!i.active || i.collected) return;
        const s = i.sz || i.displayWidth;

        if (hitPickup(box, i, s)) {
          const pType = i.pickupType || "ingredient";
          const displayName = pType === "niancinamide" ? "Niacinamide" : "B12";
          i.collected = true; 
          i.setActive(false).setVisible(false);
          this.score += 1;
          this.updateHud("Nice pick-up!");
          this.showFloatingText("+1 " + displayName);
          this.triggerPickGlow();
          if (this.coinSound) this.coinSound.play();
        }
      });

      this.enemies.getChildren().forEach(e => {
        if (!e.active || e.dead) return;
        const s = e.sz || e.displayWidth;

        // Check laser hits
        this.lasers.getChildren().forEach(l => {
          if (!l.active) return;
          const lx = l.x;
          const ly = l.y;
          const ex = e.x - s/2;
          const ey = e.y - s/2; // Center-based now for container
          if (lx > ex && lx < ex + s && ly > ey - s/2 && ly < ey + s/2) {
            l.setActive(false).setVisible(false);
            e.dead = true;
            e.setActive(false).setVisible(false);
            
            // Explosion pooling
            let exp = this.explosions.getFirstDead(false);
            if (!exp) {
              exp = this.add.sprite(e.x, e.y, "explosion");
              this.explosions.add(exp);
            } else {
              exp.setPosition(e.x, e.y);
              exp.setActive(true).setVisible(true);
            }
            exp.setScale(s / 150);
            exp.play("explode");
            exp.once('animationcomplete', () => exp.setActive(false).setVisible(false));
            
            this.score += 2;
            this.updateHud("Enemy shot down!");
            if (this.destroySound) this.destroySound.play();
          }
        });

        if (!e.dead && hitEnemy(box, e, s)) {
          e.dead = true;
          e.setActive(false).setVisible(false);
          
          // Explosion pooling
          let exp = this.explosions.getFirstDead(false);
          if (!exp) {
            exp = this.add.sprite(e.x, e.y, "explosion");
            this.explosions.add(exp);
          } else {
            exp.setPosition(e.x, e.y);
            exp.setActive(true).setVisible(true);
          }
          exp.setScale(s / 150);
          exp.play("explode");
          exp.once('animationcomplete', () => exp.setActive(false).setVisible(false));
          
          this.lives -= 1;
          this.updateHud("Hit! Lost a life.");
          this.blinkPlayer();
          if (this.hitSound) this.hitSound.play();
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
      if (this.ingredients) {
        this.ingredients.getChildren().forEach(i => i.setActive(false).setVisible(false));
      }
      if (this.enemies) {
        this.enemies.getChildren().forEach(e => e.setActive(false).setVisible(false));
      }
      if (this.lasers) {
        this.lasers.getChildren().forEach(l => l.setActive(false).setVisible(false));
      }
      if (this.explosions) {
        this.explosions.getChildren().forEach(ex => ex.setActive(false).setVisible(false));
      }
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
  const game = new Phaser.Game({
    type: Phaser.AUTO,
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
  
  // Expose game instance for resize handling
  window.game = game;
})();