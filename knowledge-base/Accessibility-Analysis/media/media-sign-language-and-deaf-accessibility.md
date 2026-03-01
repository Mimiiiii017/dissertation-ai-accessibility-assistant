# Media: Sign Language and Deaf Accessibility

## Tags
Tags: #media #sign-language #deaf #hard-of-hearing #captions #wcag #eaa

## Purpose
Ensure audio and multimedia content is accessible to Deaf and hard-of-hearing users through captions, transcripts, and where possible, sign language interpretation.

## Key points
- Captions are essential for prerecorded and live video content with audio.
- Sign language interpretation provides access for Deaf users whose primary language is a sign language (e.g., ISL, BSL, ASL, LSF).
- Captions and sign language serve different user groups — captions alone are not sufficient for all Deaf users.
- Sign language interpretation in video is a WCAG Level AAA guideline (1.2.6) but is required by the EAA for certain public services.
- Transcripts provide an alternative for users who cannot access either audio or video.
- Captions must include speaker identification, sound effects, and music descriptions where relevant.

## Developer checks
- Verify all prerecorded video has synchronised captions.
- Check that captions include speaker identification and relevant sound effects.
- Confirm captions are accurate, properly timed, and not auto-generated without review.
- Identify content where sign language interpretation would be beneficial or required.
- Verify transcripts are available for audio-only and video content.
- Ensure caption controls are accessible (keyboard operable, labelled).

## Fix patterns
- Add `<track kind="captions">` to all videos with audio.
- Review and correct auto-generated captions for accuracy.
- Include speaker identification and non-speech sounds in captions.
- Provide a sign language video window for critical content where required by regulation.
- Offer downloadable transcripts alongside media content.
- Ensure the media player allows users to toggle captions and adjust their appearance.

## Examples
```html
<!-- Video with captions and transcript -->
<video controls>
  <source src="presentation.mp4" type="video/mp4">
  <track kind="captions" src="presentation-en.vtt" srclang="en" label="English captions" default>
</video>
<details>
  <summary>View transcript</summary>
  <div class="transcript">
    <p><strong>Speaker 1:</strong> Welcome to today's presentation on accessibility.</p>
    <p><strong>[Applause]</strong></p>
    <p><strong>Speaker 1:</strong> Today we will cover the European Accessibility Act...</p>
  </div>
</details>

<!-- Sign language interpretation video (picture-in-picture) -->
<div class="video-with-sign-language">
  <video controls class="main-video">
    <source src="announcement.mp4" type="video/mp4">
    <track kind="captions" src="announcement-captions.vtt" srclang="en" label="English">
  </video>
  <video class="sign-language-video" aria-label="Sign language interpretation" muted>
    <source src="announcement-sign.mp4" type="video/mp4">
  </video>
</div>
```

```css
/* Side-by-side or picture-in-picture layout for sign language */
.video-with-sign-language {
  display: flex;
  gap: 1rem;
}

.main-video {
  flex: 3;
}

.sign-language-video {
  flex: 1;
}
```
