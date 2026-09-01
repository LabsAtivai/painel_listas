import { getActiveClients, searchActiveClients } from "./credentialsApi.js";

function paraFormatoAntigo(clients) {
  return clients.map((c) => ({
    id: c.id,
    email: c.email,
    api1: c.clientId,
    api2: c.clientSecret,
    snovioMail: c.emailSnovio,
    senha: c.senha,
  }));
}

export async function getClientes() {
  const clients = await getActiveClients();
  return paraFormatoAntigo(clients);
}

export async function buscarClientes(query) {
  const clients = await searchActiveClients(query);
  return paraFormatoAntigo(clients);
}
