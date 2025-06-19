import { render } from '@testing-library/react';
import { test } from 'vitest';

import { TestApp } from '@/test/TestApp';

test('App', () => {
  render(
    <TestApp>
      <div>Test App</div>
    </TestApp>
  );
})