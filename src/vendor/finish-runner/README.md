# finish-runner

Countdown indicator as a web component.
A white stick figure starts in sprinter's blocks and sprints in place while the ground scrolls under him and a finish line comes in from off-screen.
His chest crosses the line at the end of the countdown, then he slows down past it and cheers.
`reset()` sends a bar into his head, he falls, gets back into the blocks and still makes it in the new countdown.

No dependencies. One canvas, redrawn only while something moves and only while on screen.

## Use

```html
<finish-runner id="runner" duration="3000"></finish-runner>

<script type="module">
  import "finish-runner";

  const runner = document.querySelector("finish-runner");
  runner.addEventListener("finish", () => closeTile());

  runner.start(); // all sets done
  runner.reset(); // reps changed while counting down
  runner.stop();  // a set was undone
</script>
```

In React or similar, render `<finish-runner>` and call the methods through a ref.

## API

| | |
|---|---|
| `duration` | Attribute and property, countdown in ms. Default `3000`. |
| `start()` | Full countdown, no knockdown. |
| `reset()` | Restarts the countdown with a knockdown. Same as `start()` when not running. Resetting again while he is down only moves the deadline. |
| `stop()` | Cancels and clears. |
| `running` | `true` while counting down. |
| `finish` event | Fires at the deadline, also while scrolled out of view or detached from the page. |

Moving the element elsewhere in the page keeps the countdown going; only `stop()` ends it.

## Styling

Size it with CSS; it defaults to `display: block; height: 48px` and full width.
The figure scales with height.

```css
finish-runner {
  color: #fff;                     /* figure, finish line, ground */
  --finish-runner-hit: #ff453a;    /* bar stripes, impact lines */
  --finish-runner-done: #30d158;   /* finish line and burst on arrival */
}
```

Colors are read on `start()` and `reset()`.
Screen shake is skipped under `prefers-reduced-motion`.
The element ignores pointer events so taps reach the tile underneath.

## Timing

The finish lands on the exact deadline at any refresh rate, since every frame is computed from timestamps.
Ground speed comes from the stride, so planted feet move exactly with the ground and never slide.
The finish line starts that speed times the time left away, which is off-screen.
He holds the blocks for 150 ms, then reaches full speed over 400 ms.
After a reset, the bar takes 130 ms to fly in, the fall and getting back into the blocks take 1.35 s, then he launches again.
For durations under about 3 s, the knockdown is sped up to fit.
After `finish`, the run-out and cheer take about 1 s, so delay closing the tile by that much if you want them seen.
