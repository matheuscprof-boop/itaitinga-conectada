import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mocka a geolocalização do dispositivo.
vi.mock('../geo.js', () => ({
  obterLocalizacao: vi.fn().mockResolvedValue({ lat: -3.97, lng: -38.52 }),
}));

import RelatoRapido from './RelatoRapido.jsx';
import { obterLocalizacao } from '../geo.js';

describe('RelatoRapido (denúncia com 1 clique)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ao clicar numa categoria, obtém localização e envia FormData', async () => {
    const onCriar = vi.fn().mockResolvedValue({});
    render(<RelatoRapido onCriar={onCriar} />);

    fireEvent.click(screen.getByRole('button', { name: /Buraco na via/i }));

    await waitFor(() => expect(onCriar).toHaveBeenCalled());
    expect(obterLocalizacao).toHaveBeenCalled();
    const fd = onCriar.mock.calls[0][0];
    expect(fd).toBeInstanceOf(FormData);
    expect(fd.get('categoria')).toBe('buraco');
    expect(fd.get('latitude')).toBe('-3.97');
    expect(fd.get('longitude')).toBe('-38.52');
  });

  it('mostra erro quando a localização falha', async () => {
    obterLocalizacao.mockRejectedValueOnce(new Error('Permissão de localização negada.'));
    const onCriar = vi.fn();
    render(<RelatoRapido onCriar={onCriar} />);
    fireEvent.click(screen.getByRole('button', { name: /Lixo/i }));
    expect(await screen.findByText(/Permissão de localização negada/i)).toBeInTheDocument();
    expect(onCriar).not.toHaveBeenCalled();
  });
});
