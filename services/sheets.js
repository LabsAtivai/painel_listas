import { getActiveClients } from "./credentialsApi.js";

export async function getClientes() {
  const clients = await getActiveClients();

  return clients.map((c) => ({
    email: c.email,
    api1: c.clientId,
    api2: c.clientSecret,
    snovioMail: c.emailSnovio,
    senha: c.senha,
  }));
}
