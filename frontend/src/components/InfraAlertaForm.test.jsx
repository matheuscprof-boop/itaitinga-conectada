import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Evita carregar o Leaflet (jsdom não renderiza tiles).
vi.mock('./MapaLeaflet.jsx', () => ({ default: () => <div data-testid="mapa-mock" /> }));

import InfraAlertaForm from './InfraAlertaForm.jsx';

describe('InfraAlertaForm', () => {
  it('não envia com descrição vazia', async () => {
    const onCriar = vi.fn();
    render(<InfraAlertaForm onCriar={onCriar} />);
    fireEvent.click(screen.getByRole('button', { name: /Registrar alerta/i }));
    expect(onCriar).not.toHaveBeenCalled();
  });

  it('envia FormData com categoria, descrição e flag anônimo', async () => {
    const onCriar = vi.fn().mockResolvedValue({});
    render(<InfraAlertaForm onCriar={onCriar} />);

    fireEvent.change(screen.getByLabelText(/Categoria/i), { target: { value: 'lixo' } });
    fireEvent.change(screen.getByLabelText(/Descrição/i), { target: { value: 'Entulho na esquina' } });
    fireEvent.click(screen.getByLabelText(/anônima/i));
    fireEvent.click(screen.getByRole('button', { name: /Registrar alerta/i }));

    await waitFor(() => expect(onCriar).toHaveBeenCalled());
    const fd = onCriar.mock.calls[0][0];
    expect(fd).toBeInstanceOf(FormData);
    expect(fd.get('categoria')).toBe('lixo');
    expect(fd.get('descricao')).toBe('Entulho na esquina');
    expect(fd.get('anonimo')).toBe('1');
  });
});
