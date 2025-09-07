# iOS PWA Home Bar Solution

## The Problem
When PWAs run in standalone mode on iOS devices, content gets hidden behind the home bar (bottom gesture area) and dynamic island/notch (top area). This creates a poor user experience where important UI elements like navigation bars or music players become inaccessible.

## The Solution
Use CSS environment variables to detect and adapt to iOS safe areas:

### Key CSS Properties
- `env(safe-area-inset-bottom)` - Gets the iOS home bar height
- `env(safe-area-inset-top)` - Gets the dynamic island/notch height
- `@media (display-mode: standalone)` - Only applies adjustments when running as PWA

### Implementation
```css
/* Safe area utility classes */
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom);
}

.pt-safe {
  padding-top: env(safe-area-inset-top);
}

/* PWA-specific adjustments */
@media (display-mode: standalone) {
  .fixed.bottom-0 {
    bottom: env(safe-area-inset-bottom);
  }
  
  body {
    padding-bottom: env(safe-area-inset-bottom);
  }
}
```

### Usage Examples
```tsx
// Fixed bottom elements (music player, navigation)
<div className="fixed bottom-0 left-0 right-0">
  {/* Content automatically avoids home bar */}
</div>

// Top elements with safe area
<div style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
  {/* Content avoids dynamic island/notch */}
</div>
```

## Benefits
- ✅ Content never hidden behind iOS UI elements
- ✅ Works across all iOS devices (iPhone X+, iPad)
- ✅ Only applies when needed (PWA standalone mode)
- ✅ No JavaScript required - pure CSS solution
- ✅ Maintains native app-like experience

## Browser Support
- iOS Safari 11.2+
- All modern browsers that support CSS environment variables

## Quick Implementation
1. Add safe area CSS classes to your stylesheet
2. Apply `.pb-safe` to bottom elements
3. Apply `.pt-safe` to top elements  
4. Use `@media (display-mode: standalone)` for PWA-specific adjustments
5. Test on actual iOS devices in standalone mode

This solution ensures your PWA provides a seamless, native-like experience on iOS devices without content being obscured by system UI elements.
