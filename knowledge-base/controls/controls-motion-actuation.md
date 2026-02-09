# Controls: Motion Actuation

## Tags
Tags: #controls #motion #device-motion #wcag #2.5.4

## Purpose
Ensure functionality triggered by device motion (shaking, tilting, or other physical movement) can also be operated through a conventional user interface, and can be disabled to prevent accidental activation.

## Key points
- Any function triggered by device motion or user motion must also be operable through a standard UI control.
- Users must be able to disable motion-triggered responses to prevent accidental activation.
- Users with motor impairments may have devices mounted in fixed positions and cannot shake or tilt.
- Tremors and involuntary movements can accidentally trigger motion-based features.
- Exceptions exist when motion is essential to the function (e.g., a pedometer) or when the motion is via an accessibility-supported interface.

## Developer checks
- Identify all features triggered by device motion (accelerometer, gyroscope events).
- Verify each motion-triggered feature has an equivalent UI control (button, menu item, etc.).
- Check that motion-triggered features can be disabled in settings.
- Test the application with the device in a fixed position to confirm all functionality is reachable.
- Confirm the device motion API usage includes a fallback for unsupported or disabled motion.

## Fix patterns
- Add a button, link, or other UI control as an alternative to each motion-triggered action.
- Provide a setting to disable motion actuation entirely.
- Use feature detection for motion APIs and provide fallbacks.
- Avoid requiring motion for critical functionality such as undo or navigation.
- Document which features use motion and how to use alternatives.

## Examples
```html
<!-- Shake to undo: provide a button alternative -->
<button onclick="undoLastAction()">Undo</button>
```

```js
// Motion-triggered undo with disable option
let motionEnabled = true;

window.addEventListener('devicemotion', (e) => {
  if (!motionEnabled) return;

  const acceleration = e.accelerationIncludingGravity;
  if (Math.abs(acceleration.x) > 15 || Math.abs(acceleration.y) > 15) {
    undoLastAction();
  }
});

// Setting to disable motion actuation
document.getElementById('disableMotion').addEventListener('change', (e) => {
  motionEnabled = !e.target.checked;
});
```

```html
<!-- Settings toggle for motion -->
<label>
  <input type="checkbox" id="disableMotion"> Disable shake/tilt actions
</label>
```
