<div class="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
  <div class="blob blob-3"></div>
</div>

<style>
  .blob {
    position: absolute;
    filter: blur(100px);
  }
  .blob-1 {
    width: clamp(260px, 42vw, 580px);
    height: clamp(240px, 39vw, 540px);
    background: radial-gradient(ellipse at 40% 40%, #8000ff 0%, #4400bb 55%, transparent 78%);
    top: -200px; left: -150px; opacity: 0.48;
    border-radius: 58% 42% 54% 46% / 52% 48% 52% 48%;
    animation: breathe1 14s ease-in-out infinite alternate;
  }
  .blob-2 {
    width: clamp(200px, 34vw, 460px);
    height: clamp(180px, 31vw, 420px);
    background: radial-gradient(ellipse at 55% 45%, #ff3d00 0%, #e8006e 55%, transparent 78%);
    bottom: -130px; right: -90px; opacity: 0.36;
    border-radius: 52% 48% 58% 42% / 46% 54% 46% 54%;
    animation: breathe2 17s ease-in-out infinite alternate;
  }
  .blob-3 {
    width: clamp(140px, 24vw, 340px);
    height: clamp(130px, 22vw, 310px);
    background: radial-gradient(ellipse at 45% 50%, #00ddff 0%, #0033ee 65%, transparent 82%);
    top: 42%; left: 52%; opacity: 0.14;
    border-radius: 54% 46% 50% 50% / 50% 52% 48% 50%;
    animation: breathe1 20s ease-in-out infinite alternate;
  }
</style>
