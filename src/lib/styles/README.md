# Glass Morphism Design System

Yhtenäinen glass morphism -suunnittelujärjestelmä koko sovellukselle. Tämä kokoelma sisältää kaikki tarvittavat tyylit, värit, animaatiot ja layout-määrittelyt modernin lasimorfismi-ilmeen toteuttamiseen.

## 📁 Tiedostot

- `glass-morphism.ts` - TypeScript/JavaScript-versio (Svelte-komponenteille)
- `glass-morphism.css` - CSS-versio (vanilla CSS tai legacy-tuki)
- `README.md` - Tämä ohjetiedosto

## 🚀 Käyttöönotto

### TypeScript/Svelte-komponenteissa

```typescript
import { 
  GLASS_STYLES, 
  GLASS_COLORS, 
  GLASS_ANIMATIONS,
  glassUtils 
} from '$lib/styles/glass-morphism';

// Käytä luokkia suoraan
const cardClass = GLASS_STYLES.card;

// Tai käytä utility-funktioita
const buttonClass = glassUtils.button('primary');
const toggleClass = glassUtils.toggle(isSelected);
```

### CSS-versio

```css
/* Importtaa CSS-tiedosto */
@import '$lib/styles/glass-morphism.css';
```

```html
<!-- Käytä luokkia HTML:ssä -->
<div class="glass-card glass-container">
  <h1 class="glass-gradient-title">Otsikko</h1>
  <button class="glass-button glass-button-primary">Painike</button>
</div>
```

## 🎨 Päätyylit

### Taustat ja kontainerit

```typescript
// TypeScript
GLASS_STYLES.card           // Pääkortit
GLASS_STYLES.cardLight      // Kevyet kortit (sisäkkäiset)
GLASS_STYLES.modal          // Modaalit
GLASS_BACKGROUNDS.main      // Pääkontti gradientilla
```

```css
/* CSS */
.glass-card                 /* Pääkortit */
.glass-card-light          /* Kevyet kortit */
.glass-card-heavy          /* Modaalit */
.glass-background          /* Taustagradienti */
```

### Painikkeet

```typescript
// TypeScript - utility-funktioilla
glassUtils.button('primary')    // Ensisijainen painike
glassUtils.button('secondary')  // Toissijainen painike  
glassUtils.button('ghost')      // Läpinäkyvä painike
glassUtils.toggle(true)         // Valittu toggle
glassUtils.toggle(false)        // Ei-valittu toggle
```

```css
/* CSS */
.glass-button                   /* Peruspainike */
.glass-button-primary          /* + ensisijainen väri */
.glass-button-secondary        /* + toissijainen väri */
.glass-button-ghost           /* + läpinäkyvä */
.glass-toggle-selected        /* Valittu tila */
.glass-toggle-unselected      /* Ei-valittu tila */
```

### Lomakeelementit

```typescript
// TypeScript
GLASS_STYLES.input          // Input-kentät
GLASS_STYLES.select         // Pudotusvalikot
```

```css
/* CSS */
.glass-input                /* Input-kentät */
.glass-select              /* Pudotusvalikot */
```

## 🌊 Floating-elementit

### TypeScript/Svelte

```svelte
<div class="{GLASS_BACKGROUNDS.main}">
  <!-- Floating particles -->
  <div class="fixed inset-0 z-0 overflow-hidden pointer-events-none">
    {@html GLASS_BACKGROUNDS.floatingParticles}
  </div>
  
  <!-- Sisältö -->
  <div class="{GLASS_BACKGROUNDS.contentLayer} {GLASS_LAYOUT.container}">
    <div class="{GLASS_STYLES.card}">
      Sisältö tähän...
    </div>
  </div>
</div>
```

### CSS

```html
<div class="glass-background">
  <!-- Floating particles -->
  <div class="glass-floating-container">
    <div class="glass-particle glass-particle-1"></div>
    <div class="glass-particle glass-particle-2"></div>
    <div class="glass-particle glass-particle-3"></div>
    <div class="glass-particle glass-particle-4"></div>
    <div class="glass-particle glass-particle-5"></div>
  </div>
  
  <!-- Sisältö -->
  <div class="glass-content glass-container">
    <div class="glass-card">
      Sisältö tähän...
    </div>
  </div>
</div>
```

## 🎯 Layout-järjestelmä

### Grid-layoutit

```typescript
// TypeScript
GLASS_LAYOUT.statsGrid      // 1-2-4 kolumnin grid (stats)
GLASS_LAYOUT.playerGrid     // 1-2-3-4 kolumnin grid (pelaajat)
GLASS_LAYOUT.categoryGrid   // 2-3-5 kolumnin grid (kategoriat)
```

```css
/* CSS */
.glass-grid-stats          /* Tilastot grid */
.glass-grid-players        /* Pelaajat grid */
```

### Spacing ja padding

```typescript
// TypeScript
GLASS_LAYOUT.container      // Pääkontti
GLASS_LAYOUT.section        // Osio-spacing
GLASS_LAYOUT.padding.card   // Kortti-padding
```

```css
/* CSS */
.glass-container           /* Pääkontti */
.glass-section            /* Osio-spacing */
```

## 🎨 Värit ja teemoitus

### Gradientit

```typescript
// TypeScript
GLASS_COLORS.titleGradient  // Otsikko-gradientti (primary -> secondary)
```

```css
/* CSS */
.glass-gradient-title      /* Otsikko-gradientti */
```

### Värikoodit

```typescript
// TypeScript
GLASS_COLORS.error         // Virhe-korostus
GLASS_COLORS.success       // Onnistumis-korostus
GLASS_COLORS.textSecondary // Toissijainen teksti
```

## ⚡ Animaatiot

### Hover-efektit

```typescript
// TypeScript
GLASS_ANIMATIONS.hoverScale    // Hover-skaalaus
GLASS_ANIMATIONS.hoverShadow   // Hover-varjo
```

```css
/* CSS */
.glass-hover-scale         /* Hover-skaalaus */
.glass-hover-shadow        /* Hover-varjo */
.glass-transition         /* Siirtymäanimaatio */
```

### Tila-animaatiot

```css
/* CSS */
.glass-pulse              /* Pulse-animaatio */
.glass-bounce             /* Bounce-animaatio */
.glass-spinner            /* Loading-spinner */
```

## 📱 Responsiivinen suunnittelu

### Breakpointit

```typescript
// TypeScript
GLASS_RESPONSIVE.mobile     // Mobile first
GLASS_RESPONSIVE.tablet     // md: 768px+
GLASS_RESPONSIVE.desktop    // lg: 1024px+
```

### Responsiivinen teksti

```typescript
// TypeScript
GLASS_RESPONSIVE.text.title     // Responsiivinen otsikko
GLASS_RESPONSIVE.text.subtitle  // Responsiivinen alaotsikko
```

## 🛠️ Utility-funktiot

### glassUtils

```typescript
// Yhdistä luokkia
glassUtils.combine('class1', 'class2', conditionalClass);

// Luo kortti
glassUtils.card('extra-classes');

// Luo painike
glassUtils.button('primary', 'extra-classes');

// Luo toggle
glassUtils.toggle(isSelected, 'extra-classes');

// Luo input
glassUtils.input('extra-classes');

// Luo floating-tausta
glassUtils.floatingBackground();
```

## 🎯 Esimerkkejä

### Perussivu

```svelte
<script lang="ts">
  import { GLASS_BACKGROUNDS, GLASS_STYLES, GLASS_LAYOUT, glassUtils } from '$lib/styles/glass-morphism';
</script>

<div class="{GLASS_BACKGROUNDS.main}">
  <!-- Floating background -->
  <div class="fixed inset-0 z-0 overflow-hidden pointer-events-none">
    {@html GLASS_BACKGROUNDS.floatingParticles}
  </div>
  
  <!-- Content -->
  <div class="{GLASS_BACKGROUNDS.contentLayer} {GLASS_LAYOUT.container}">
    <div class="{GLASS_STYLES.card} {GLASS_LAYOUT.padding.card}">
      <h1 class="text-3xl font-bold {GLASS_COLORS.titleGradient}">
        Otsikko
      </h1>
      
      <div class="{GLASS_LAYOUT.spacing.medium}">
        <button class="{glassUtils.button('primary')}">
          Ensisijainen toiminto
        </button>
        
        <button class="{glassUtils.button('ghost')}">
          Toissijainen toiminto
        </button>
      </div>
    </div>
  </div>
</div>
```

### Modal

```svelte
{#if showModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <div class="{GLASS_STYLES.modal} w-full max-w-md">
      <div class="{GLASS_LAYOUT.padding.modal}">
        <h3 class="text-xl font-bold {GLASS_COLORS.titleGradient} mb-4">
          Modal-otsikko
        </h3>
        
        <input class="{GLASS_STYLES.input}" placeholder="Syöte..." />
        
        <div class="flex justify-end space-x-3 mt-6">
          <button class="{glassUtils.button('ghost')}" on:click={() => showModal = false}>
            Peruuta
          </button>
          <button class="{glassUtils.button('primary')}" on:click={save}>
            Tallenna
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
```

## 🎨 Räätälöinti

### CSS Custom Properties

Voit muokata tyylejä muuttamalla CSS custom propertyja:

```css
:root {
  --glass-opacity-medium: 0.85;    /* Vähemmän läpinäkyvä */
  --glass-blur-lg: 20px;           /* Enemmän blurria */
  --glass-scale-hover: 1.05;       /* Suurempi hover-efekti */
}
```

### TypeScript Constants

Tai muokkaa TypeScript-vakioita:

```typescript
// Kopioi glass-morphism.ts ja muokkaa arvoja
export const CUSTOM_GLASS_STYLES = {
  ...GLASS_STYLES,
  card: "bg-white/95 dark:bg-surface-900/95 backdrop-blur-xl rounded-3xl...",
};
```

## 📚 Komponenttikohtaiset tyylit

Valmiit tyylikokoelmat yleisille komponenteille:

```typescript
// Hero-osio
GLASS_COMPONENTS.hero.container
GLASS_COMPONENTS.hero.title
GLASS_COMPONENTS.hero.subtitle

// Navigaatio
GLASS_COMPONENTS.navigation.container
GLASS_COMPONENTS.navigation.tab
GLASS_COMPONENTS.navigation.tabActive

// Pelaajan kortit
GLASS_COMPONENTS.player.card
GLASS_COMPONENTS.player.avatar
GLASS_COMPONENTS.player.name

// Kysymykset
GLASS_COMPONENTS.question.card
GLASS_COMPONENTS.question.header
GLASS_COMPONENTS.question.title

// Tilastot
GLASS_COMPONENTS.stats.card
GLASS_COMPONENTS.stats.icon
GLASS_COMPONENTS.stats.value
```

## 🔧 TypeScript-tuki

Tyypitetyt interfacet ovat saatavilla:

```typescript
import type { 
  GlassStyleKey, 
  GlassColorKey, 
  ButtonVariant 
} from '$lib/styles/glass-morphism';

const style: GlassStyleKey = 'card';
const variant: ButtonVariant = 'primary';
```

Tämä design system tarjoaa yhtenäisen ja skaalautuvan pohjan koko sovelluksen glass morphism -tyylille! 🚀