import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

jest.mock('./utils/api', () => {
  const api = {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      response: {
        use: jest.fn(),
      },
    },
  };

  return {
    __esModule: true,
    default: api,
    projectAPI: {
      create: jest.fn(),
      getAll: jest.fn(),
      getById: jest.fn(),
      delete: jest.fn(),
    },
    serviceAPI: {
      getAll: jest.fn(),
      deploy: jest.fn(),
      getById: jest.fn(),
      redeploy: jest.fn(),
      delete: jest.fn(),
      getLogs: jest.fn(),
      setEnv: jest.fn(),
      deleteEnv: jest.fn(),
      update: jest.fn(),
      validateRepo: jest.fn(),
    },
    deploymentAPI: {
      getById: jest.fn(),
      getLogs: jest.fn(),
    },
    userAPI: {
      register: jest.fn(),
      login: jest.fn(),
      verify: jest.fn(),
      getCurrent: jest.fn(),
      logout: jest.fn(),
    },
  };
});

beforeEach(() => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: false }));
});

test('renders the landing page', async () => {
  render(<App />);
  expect(
    screen.getByText(/Deploy your repos from a beautiful command center/i)
  ).toBeInTheDocument();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
});
