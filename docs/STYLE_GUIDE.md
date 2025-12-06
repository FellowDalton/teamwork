# LingoLift Style Guide

A comprehensive design system for replicating the LingoLift visual aesthetic in other projects.

---

## Quick Start

### Dependencies

```html
<!-- Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Merriweather:wght@300;400;700&display=swap" rel="stylesheet">

<!-- Tailwind CSS -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- Lucide Icons (React) -->
npm install lucide-react
```

### Tailwind Configuration

```javascript
tailwind.config = {
  theme: {
    extend: {
      colors: {
        paper: {
          50: '#FBFBF9',
          100: '#F5F4F0',
          200: '#EBE9E4',
          300: '#D8D4CD',
          800: '#4A4842',
          900: '#2C2B28',
        },
        earth: {
          terra: '#A44A3F',
          sage: '#5B7553',
          clay: '#8C7B6C',
          sand: '#D4C5B0',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Merriweather', 'Georgia', 'serif'],
      }
    }
  }
}
```

### Base Styles

```css
body {
  background-color: #F5F4F0; /* paper-100 */
  color: #2C2B28; /* paper-900 */
  font-family: 'Inter', system-ui, sans-serif;
}

/* Custom Scrollbars */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #D8D4CD; /* paper-300 */
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #8C7B6C; /* earth-clay */
}
```

---

## Color Palette

### Paper (Neutrals)

| Token | Hex | Usage |
|-------|-----|-------|
| `paper-50` | `#FBFBF9` | Lightest backgrounds, hover states |
| `paper-100` | `#F5F4F0` | Page background, sidebar |
| `paper-200` | `#EBE9E4` | Secondary backgrounds, dividers |
| `paper-300` | `#D8D4CD` | Borders, scrollbar |
| `paper-800` | `#4A4842` | Secondary text |
| `paper-900` | `#2C2B28` | Primary text |

### Earth (Accents)

| Token | Hex | Usage |
|-------|-----|-------|
| `earth-terra` | `#A44A3F` | Primary CTA, brand accent |
| `earth-sage` | `#5B7553` | Secondary actions, success states |
| `earth-clay` | `#8C7B6C` | Tertiary elements, icons |
| `earth-sand` | `#D4C5B0` | Light accents, highlights |

### Semantic Colors

| State | Background | Text | Border |
|-------|------------|------|--------|
| Error | `red-50` | `red-600` | `red-200` |
| Success | `earth-sage/10` | `earth-sage` | `earth-sage` |
| Warning | `bg-yellow-50` | `yellow-700` | `yellow-200` |

---

## Typography

### Font Families

```css
/* Sans-serif - Body text, UI elements */
font-family: 'Inter', system-ui, sans-serif;
/* Tailwind: font-sans */

/* Serif - Headings, emphasis */
font-family: 'Merriweather', Georgia, serif;
/* Tailwind: font-serif */

/* Monospace - Code, content display */
font-family: ui-monospace, monospace;
/* Tailwind: font-mono */
```

### Type Scale

| Class | Size | Usage |
|-------|------|-------|
| `text-xs` | 12px | Labels, badges, metadata |
| `text-sm` | 14px | Body text, form labels |
| `text-base` | 16px | Default body |
| `text-lg` | 18px | Section headers |
| `text-xl` | 20px | Subsection headers |
| `text-2xl` | 24px | Page headers |
| `text-3xl` | 30px | Hero headers |

### Font Weights

| Class | Weight | Usage |
|-------|--------|-------|
| `font-medium` | 500 | Emphasized body text |
| `font-semibold` | 600 | Strong emphasis |
| `font-bold` | 700 | Headers, buttons |

### Heading Pattern

```jsx
// Page title
<h1 className="font-serif font-bold text-2xl text-paper-900">
  Page Title
</h1>

// Section header
<h2 className="font-serif text-lg text-paper-800">
  Section Title
</h2>

// Uppercase label
<span className="text-xs uppercase tracking-wider text-paper-500 font-medium">
  Label
</span>
```

---

## Spacing

### Standard Scale

| Value | Pixels | Common Usage |
|-------|--------|--------------|
| `1` | 4px | Icon gaps, tight spacing |
| `2` | 8px | Button padding, small gaps |
| `3` | 12px | Table cells, compact cards |
| `4` | 16px | Card padding, standard gaps |
| `6` | 24px | Section padding |
| `8` | 32px | Large content areas |

### Common Patterns

```jsx
// Standard card padding
className="p-4"

// Compact button padding
className="px-3 py-2"

// Flex/grid gaps
className="gap-2"  // Tight
className="gap-4"  // Standard
className="gap-6"  // Spacious
```

---

## Borders & Radius

### Border Radius

| Class | Size | Usage |
|-------|------|-------|
| `rounded-md` | 6px | Buttons, inputs |
| `rounded-lg` | 8px | Cards, panels |
| `rounded-xl` | 12px | Modals |
| `rounded-full` | 50% | Avatars, badges |

### Border Styles

```jsx
// Standard border
className="border border-paper-200"

// Subtle border
className="border border-paper-100"

// Strong border
className="border border-paper-300"

// Accent border
className="border-2 border-earth-terra"

// Dashed (empty states)
className="border-2 border-dashed border-paper-300"
```

---

## Shadows

| Class | Usage |
|-------|-------|
| `shadow-sm` | Cards, buttons |
| `shadow-md` | Dropdowns, hover states |
| `shadow-lg` | Modals, dialogs |

---

## Components

### Button

```jsx
// Base classes
const buttonBase = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

// Variants
const variants = {
  primary: "bg-earth-terra text-white hover:bg-[#8a3d34] focus:ring-earth-terra",
  secondary: "bg-earth-sage text-white hover:bg-[#4a6043] focus:ring-earth-sage",
  outline: "border border-earth-clay text-paper-800 hover:bg-earth-clay/10 focus:ring-earth-clay",
  ghost: "text-paper-800 hover:bg-paper-200 focus:ring-paper-300",
};

// Sizes
const sizes = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};
```

**Usage:**
```jsx
<button className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium rounded-md bg-earth-terra text-white hover:bg-[#8a3d34] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-earth-terra">
  <Plus className="w-4 h-4 mr-2" />
  Add Item
</button>
```

### Input

```jsx
<input
  className="w-full p-2 border border-paper-300 rounded-md bg-white focus:ring-2 focus:ring-earth-sage focus:border-earth-sage outline-none transition-colors"
  placeholder="Enter text..."
/>

// Textarea variant
<textarea
  className="w-full p-3 border border-paper-300 rounded-md bg-paper-50 focus:ring-2 focus:ring-earth-sage focus:border-earth-sage outline-none resize-none"
  rows={4}
/>

// Select
<select className="w-full p-2 border border-paper-300 rounded-md bg-white focus:ring-2 focus:ring-earth-sage focus:border-earth-sage outline-none">
  <option>Option 1</option>
</select>
```

### Card

```jsx
// Standard card
<div className="bg-white p-4 rounded-lg border border-paper-200 shadow-sm">
  Content
</div>

// Interactive card
<div className="bg-white p-4 rounded-lg border border-paper-200 shadow-sm hover:shadow-md hover:border-paper-300 transition-all cursor-pointer">
  Click me
</div>

// Selected card
<div className="bg-white p-4 rounded-lg border-2 border-earth-terra shadow-sm ring-1 ring-earth-terra">
  Selected
</div>
```

### Badge

```jsx
// Neutral badge
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-paper-200 text-paper-600">
  Label
</span>

// Colored badges
<span className="bg-earth-sage/10 text-earth-sage ...">Success</span>
<span className="bg-earth-terra/10 text-earth-terra ...">Primary</span>
<span className="bg-red-50 text-red-600 ...">Error</span>
```

### Toggle/Switch

```jsx
<label className="relative inline-flex items-center cursor-pointer">
  <input type="checkbox" className="sr-only peer" />
  <div className="w-10 h-5 bg-paper-300 rounded-full peer-checked:bg-earth-sage transition-colors"></div>
  <div className="absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform peer-checked:translate-x-5 shadow-sm"></div>
</label>
```

---

## Layout Patterns

### Sidebar Layout

```jsx
<div className="flex h-screen bg-paper-100">
  {/* Sidebar */}
  <aside className="w-64 bg-paper-100 border-r border-paper-300 flex flex-col">
    {/* Logo */}
    <div className="p-4 border-b border-paper-200">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-earth-terra rounded-lg flex items-center justify-center text-white">
          <Icon className="w-5 h-5" />
        </div>
        <span className="font-serif font-bold text-lg tracking-tight">Brand</span>
      </div>
    </div>

    {/* Navigation */}
    <nav className="flex-1 p-4 space-y-1">
      {/* Nav item */}
      <a className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-paper-800 hover:bg-paper-200 transition-colors">
        <Icon className="w-5 h-5 text-paper-400" />
        Nav Item
      </a>

      {/* Active nav item */}
      <a className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium bg-white text-earth-terra shadow-sm ring-1 ring-paper-200">
        <Icon className="w-5 h-5" />
        Active Item
      </a>
    </nav>
  </aside>

  {/* Main content */}
  <main className="flex-1 overflow-hidden">
    <div className="h-full overflow-y-auto p-6">
      Content
    </div>
  </main>
</div>
```

### Card Grid

```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {items.map(item => (
    <div className="bg-white p-4 rounded-lg border border-paper-200 shadow-sm">
      {item}
    </div>
  ))}
</div>
```

### Header with Actions

```jsx
<div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="font-serif font-bold text-2xl text-paper-900">Title</h1>
    <p className="text-sm text-paper-500 mt-1">Description</p>
  </div>
  <div className="flex items-center gap-2">
    <button className="...">Action</button>
  </div>
</div>
```

### Two-Column Panel

```jsx
<div className="flex h-full">
  {/* List panel */}
  <div className="w-1/3 border-r border-paper-200 overflow-y-auto">
    {/* List items */}
  </div>

  {/* Detail panel */}
  <div className="flex-1 overflow-y-auto p-6">
    {/* Content */}
  </div>
</div>
```

---

## Tables

```jsx
<div className="bg-white rounded-lg border border-paper-200 shadow-sm overflow-hidden">
  <table className="w-full text-sm text-left">
    <thead className="bg-paper-100 border-b border-paper-200">
      <tr>
        <th className="p-4 font-semibold text-paper-800">Column</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-paper-100">
      <tr className="hover:bg-paper-50 transition-colors">
        <td className="p-4 text-paper-900">Data</td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## Empty States

```jsx
<div className="flex flex-col items-center justify-center h-64 text-center">
  <div className="w-16 h-16 bg-paper-200 rounded-2xl flex items-center justify-center mb-4">
    <Icon className="w-8 h-8 text-paper-400" />
  </div>
  <h3 className="font-medium text-paper-900 mb-2">No items yet</h3>
  <p className="text-sm text-paper-500 mb-4 max-w-sm">
    Description of what the user can do.
  </p>
  <button className="...">Add Item</button>
</div>
```

---

## Modal/Dialog

```jsx
{/* Backdrop */}
<div className="fixed inset-0 bg-paper-900/50 flex items-center justify-center z-50">
  {/* Modal */}
  <div className="bg-white rounded-xl shadow-lg border border-paper-200 w-full max-w-md p-6">
    {/* Header */}
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-serif font-bold text-lg">Title</h2>
      <button className="p-1 hover:bg-paper-100 rounded-md">
        <X className="w-5 h-5 text-paper-400" />
      </button>
    </div>

    {/* Content */}
    <div className="mb-6">
      Content here
    </div>

    {/* Footer */}
    <div className="flex justify-end gap-2">
      <button className="...ghost...">Cancel</button>
      <button className="...primary...">Confirm</button>
    </div>
  </div>
</div>
```

---

## Icons

Using [Lucide React](https://lucide.dev):

| Size | Classes | Usage |
|------|---------|-------|
| Tiny | `w-3 h-3` | Indicators, bullets |
| Small | `w-4 h-4` | Buttons, inline |
| Medium | `w-5 h-5` | Navigation, toolbar |
| Large | `w-6 h-6` | Section headers |
| XL | `w-8 h-8` | Avatars, loaders |
| XXL | `w-16 h-16` | Empty states |

**Icon Colors:**
- Default: `text-paper-400` or `text-paper-500`
- Active: `text-earth-terra`
- Success: `text-earth-sage`
- Neutral: `text-earth-clay`
- Error: `text-red-600`

---

## Animations

### Built-in

```jsx
// Spinner
<div className="animate-spin w-8 h-8 border-4 border-paper-200 border-t-earth-terra rounded-full" />

// Pulse (loading)
<div className="animate-pulse bg-paper-200 rounded h-4 w-24" />
```

### Transitions

```jsx
// Color transitions
className="transition-colors"

// All properties
className="transition-all"

// Specific duration
className="transition-all duration-200"
```

---

## Interactive States

### Hover

```jsx
hover:bg-paper-50       // Subtle highlight
hover:bg-paper-100      // Light highlight
hover:bg-paper-200      // Medium highlight
hover:border-paper-400  // Border darken
hover:shadow-md         // Depth increase
hover:text-earth-terra  // Text color change
```

### Focus

```jsx
focus:outline-none
focus:ring-2
focus:ring-earth-terra  // Primary focus
focus:ring-earth-sage   // Form focus
focus:ring-offset-2
```

### Disabled

```jsx
disabled:opacity-50
disabled:cursor-not-allowed
```

---

## Responsive Breakpoints

| Prefix | Min Width | Usage |
|--------|-----------|-------|
| (none) | 0px | Mobile first |
| `sm:` | 640px | Large phones |
| `md:` | 768px | Tablets |
| `lg:` | 1024px | Desktops |
| `xl:` | 1280px | Large screens |

**Common Patterns:**

```jsx
// Grid columns
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"

// Hidden/visible
className="hidden md:block"
className="md:hidden"

// Flex direction
className="flex flex-col md:flex-row"

// Width changes
className="w-full md:w-1/2 lg:w-1/3"
```

---

## CSS Variables (Alternative)

If you prefer CSS variables over Tailwind config:

```css
:root {
  /* Paper palette */
  --color-paper-50: #FBFBF9;
  --color-paper-100: #F5F4F0;
  --color-paper-200: #EBE9E4;
  --color-paper-300: #D8D4CD;
  --color-paper-800: #4A4842;
  --color-paper-900: #2C2B28;

  /* Earth palette */
  --color-earth-terra: #A44A3F;
  --color-earth-terra-dark: #8a3d34;
  --color-earth-sage: #5B7553;
  --color-earth-sage-dark: #4a6043;
  --color-earth-clay: #8C7B6C;
  --color-earth-sand: #D4C5B0;

  /* Spacing */
  --spacing-unit: 4px;

  /* Border radius */
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
}
```

---

## Design Principles

1. **Warm, earthy aesthetic** - Uses natural tones instead of stark whites and blues
2. **Subtle depth** - Light shadows, thin borders rather than heavy elevation
3. **Typography contrast** - Serif for headers creates visual hierarchy with sans-serif body
4. **Generous whitespace** - p-4 and gap-4 as standard spacing units
5. **Consistent interaction** - Same hover/focus patterns throughout
6. **Mobile-first** - All layouts start with single column
7. **Accessibility** - Focus rings, sufficient contrast ratios

---

## File Structure Reference

```
src/
├── components/
│   └── Button.tsx       # Reusable button component
├── views/               # Page components
├── context/             # State management
├── types.ts             # TypeScript interfaces
└── constants.ts         # Design tokens, defaults

index.html               # Tailwind config, fonts, base styles
```

---

## Copy-Paste Starter

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Merriweather:wght@300;400;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            paper: {
              50: '#FBFBF9',
              100: '#F5F4F0',
              200: '#EBE9E4',
              300: '#D8D4CD',
              800: '#4A4842',
              900: '#2C2B28',
            },
            earth: {
              terra: '#A44A3F',
              sage: '#5B7553',
              clay: '#8C7B6C',
              sand: '#D4C5B0',
            }
          },
          fontFamily: {
            sans: ['Inter', 'system-ui', 'sans-serif'],
            serif: ['Merriweather', 'Georgia', 'serif'],
          }
        }
      }
    }
  </script>
  <style>
    body {
      background-color: #F5F4F0;
      color: #2C2B28;
    }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #D8D4CD; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #8C7B6C; }
  </style>
</head>
<body class="font-sans antialiased">
  <!-- Your content -->
</body>
</html>
```
