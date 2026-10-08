import type { RendererStatus } from './renderer';

/** Text for the status line, or null when the character is shown normally. */
export function describeRendererStatus(status: RendererStatus): string | null {
  switch (status.state) {
    case 'loading':
      return '캐릭터를 불러오고 있어요.';
    case 'ready':
      return null;
    case 'sdk_unavailable':
      return 'Live2D SDK가 연결되지 않은 빌드예요. 캐릭터는 SDK를 준비한 빌드에서만 보여요.';
    case 'webgl_unavailable':
      return '이 브라우저에서는 캐릭터를 표시할 수 없어요. (WebGL 미지원)';
    case 'error':
      return '캐릭터를 불러오지 못했어요. 새로고침해 주세요.';
  }
}
