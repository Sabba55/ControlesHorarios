export function normalizarTiempo(valor) {
  const soloDigitos = valor.replace(/\D/g, '').slice(0, 4);

  if (soloDigitos.length <= 2) {
    return soloDigitos;
  }

  return `${soloDigitos.slice(0, 2)}:${soloDigitos.slice(2)}`;
}

export function esTiempoValido(valor) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(valor);
}

export function tiempoAMinutos(valor) {
  if (!esTiempoValido(valor)) {
    return null;
  }

  const [horas, minutos] = valor.split(':').map(Number);
  return (horas * 60) + minutos;
}

export function minutosATiempo(totalMinutos) {
  const minutosNormalizados = ((totalMinutos % 1440) + 1440) % 1440;
  const horas = String(Math.floor(minutosNormalizados / 60)).padStart(2, '0');
  const minutos = String(minutosNormalizados % 60).padStart(2, '0');
  return `${horas}:${minutos}`;
}

export function sumarTiempo(base, incremento) {
  const minutosBase = tiempoAMinutos(base);
  const minutosIncremento = tiempoAMinutos(incremento);

  if (minutosBase === null || minutosIncremento === null) {
    return null;
  }

  return minutosATiempo(minutosBase + minutosIncremento);
}
