(() => {
  "use strict";

  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const stateEl = document.getElementById("state");
  const overlay = document.getElementById("overlay");
  const startBtn = document.getElementById("start");
  const rotatePrompt = document.getElementById("rotate-prompt");
  const gameWrap = document.getElementById("game-wrap");

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
  const BIKE_DISPLAY_H = 110;
  const WHEELIE_ANGLE = -45;
  const WHEELIE_DURATION = 1;
  const ingredientsPalette = ["#f8d15b", "#6fd3f2", "#f48fa6", "#7ce3b1"];

  /* ---------- Generated textures ---------- */
  function createTextures(scene) {
    const enemyG = scene.add.graphics();
    enemyG.fillStyle(0x2f5b6a, 1);
    enemyG.fillRect(0, 16, 80, 56);
    enemyG.fillStyle(0xc0dde6, 1);
    enemyG.fillRect(6, 20, 68, 14);
    enemyG.fillStyle(0x7bdff6, 1);
    enemyG.fillCircle(24, 76, 12);
    enemyG.fillCircle(56, 76, 12);
    enemyG.generateTexture("enemy", 80, 96);
    enemyG.destroy();
  }

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
      this.load.image("bike", "assets/Images/Bike-Sprite.png");
      this.load.image("bg", "assets/Images/bg.png");
      this.load.audio("motorcycle", "assets/sounds/motorcycle.mp3");
      this.load.spritesheet("explosion", "assets/animations/Dustexplosion.png", {
        frameWidth: 600,
        frameHeight: 525
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

      createTextures(this);
    }

    create() {
      const w = this.scale.width;
      const h = this.scale.height;
      this.groundY = Math.round(h * 0.845) + 7;

      this.motorcycleSound = this.sound.add("motorcycle", { loop: true, volume: 0.2 });

      if (!this.anims.exists("explode")) {
        this.anims.create({
          key: "explode",
          frames: this.anims.generateFrameNumbers("explosion", { start: 0, end: 4 }),
          duration: 300,
          repeat: 0
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

      this.bg = this.add.tileSprite(0, 0, w || 1280, h || 720, "bg");
      this.bg.setOrigin(0, 0);
      this.bg.setDepth(-1);
      const bgScale = Math.max((w || 1280) / 6000, (h || 720) / 805);
      this.bg.tileScaleX = bgScale;
      this.bg.tileScaleY = bgScale;

      this.player = this.add.sprite((w || 1280) * 0.18, this.groundY, "bike");
      this.player.setOrigin(0.15, 0.95);
      this.player.setDepth(10);
      this.player.displayWidth = BIKE_DISPLAY_W;
      this.player.displayHeight = BIKE_DISPLAY_H;

      this.ingredients = this.add.group();
      this.enemies = this.add.group();

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
        this.player.x = w * 0.18;
        this.player.y = this.groundY;
      }
    }

    setupInput() {
      this.input.on("pointerdown", () => {
        if (!this.running) return;
        if (this.wheelieTime <= 0) {
          this.wheelieTime = WHEELIE_DURATION;
        }
      });
      startBtn.addEventListener("click", () => this.startGame());
    }

    resetGameState() {
      this.score = 0;
      this.lives = 3;
      this.wheelieTime = 0;
      this.nextSpawnTimer = 0;
      this.ingredients.clear(true, true);
      this.enemies.clear(true, true);
      if (this.player) {
        this.player.x = this.scale.width * 0.18;
        this.player.y = this.groundY;
        this.player.angle = 0;
      }
      this.updateHud("Tap anywhere to wheelie");
    }

    startGame() {
      overlay.style.display = "none";
      this.resetGameState();
      this.running = true;
      if (this.motorcycleSound) {
        this.motorcycleSound.play();
      }
    }

    updateHud(msg) {
      scoreEl.textContent = "Score: " + this.score;
      livesEl.textContent = "Lives: " + this.lives;
      if (msg) stateEl.textContent = msg;
    }

    spawnIngredient() {
      const type = Math.random() < 0.5 ? "niancinamide" : "methanol";
      const sz = 60 + Math.random() * 20;
      const y = this.groundY - sz / 2 - 20; // Float slightly above ground

      if (type === "niancinamide") {
        const sp = this.add.sprite(this.scale.width + 80, y, "niancinamide");
        sp.setDisplaySize(sz, sz);
        sp.play("niancinamide_anim");
        sp.pickupType = "niancinamide";
        this.ingredients.add(sp);
      } else {
        // Methanol with pulsating glow
        const container = this.add.container(this.scale.width + 80, y);
        
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
      const sz = 48 + Math.random() * 18;
      const sp = this.add.sprite(this.scale.width + 120, this.groundY, "enemy");
      sp.setOrigin(0.5, 1);
      sp.setScale(sz / 80);
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

      const hit = (b, o, s) => {
        return b.x < o.x + s && b.x + b.width > o.x &&
               b.y - b.height < o.y - s + s && b.y > o.y - s;
      };

      this.ingredients.getChildren().forEach(i => {
        if (i.collected) return;
        
        let s;
        if (i.type === "Container") {
          s = i.sz;
        } else {
          s = i.displayWidth;
        }

        // Adjust collision check for center-based or origin-based items
        const hitPickup = (b, o, sz) => {
          const ox = (o.type === "Container" || o.originX === 0.5) ? o.x - sz/2 : o.x;
          const oy = (o.type === "Container" || o.originY === 0.5) ? o.y - sz/2 : o.y;
          return b.x < ox + sz && b.x + b.width > ox &&
                 b.y - b.height < oy + sz && b.y > oy;
        };

        if (hitPickup(box, i, s)) {
          i.collected = true; 
          i.destroy();
          this.score += 1;
          this.updateHud("Nice pick-up!");
        }
      });

      this.enemies.getChildren().forEach(e => {
        if (e.dead) return;
        const s = 80 * e.scaleX;
        if (hit(box, e, s)) {
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
          }
        }
      });

      this.ingredients.getChildren().forEach(i => { if (i.x < -80) i.destroy(); });
      this.enemies.getChildren().forEach(e => { if (e.x < -80) e.destroy(); });

      if (this.lives <= 0) {
        this.running = false;
        if (this.motorcycleSound) {
          this.motorcycleSound.stop();
        }
        overlay.style.display = "grid";
        overlay.querySelector("h1").textContent = "Game Over";
        overlay.querySelector("p").textContent = "Tap start to ride again.";
        startBtn.textContent = "Restart";
        this.updateHud("Game over");
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
    },
    scene: [MainScene],
    physics: { default: "arcade", arcade: { gravity: { y: 0 }, debug: false } },
    fps: { target: 60, forceSetTimeOut: true },
  });
})();
