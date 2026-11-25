function openPassword() {
  $('#modal').innerHTML = '<div class="dialog"><h2>Trocar minha senha</h2><p class="sub">Ao concluir, todas as sessões anteriores serão encerradas.</p><form class="form" id="passwordForm"><label>Senha atual<input id="currentPassword" type="password" required autocomplete="current-password"></label><label>Nova senha<input id="newPassword" type="password" minlength="10" required autocomplete="new-password"></label><label>Confirmar nova senha<input id="confirmPassword" type="password" minlength="10" required autocomplete="new-password"></label><div class="actions"><button type="button" class="plain" onclick="closeModal()">Cancelar</button><button class="primary">Salvar nova senha</button></div></form></div>';
  $('#modal').classList.add('open');
  $('#passwordForm').onsubmit = async event => {
    event.preventDefault();
    if ($('#newPassword').value !== $('#confirmPassword').value) return toast('As novas senhas não conferem.');
    try {
      await api('/api/auth', {method:'POST', body:JSON.stringify({action:'change_password', current_password:$('#currentPassword').value, new_password:$('#newPassword').value})});
      closeModal(); toast('Senha atualizada. Entre novamente para continuar.');
      setTimeout(() => location.reload(), 1000);
    } catch (error) { toast(error.message); }
  };
}

async function addRecoveryPanel() {
  const host = $('#settings');
  const list = $('#accessList');
  if (!host || !list || $('#recoveryPanel') || !current?.is_admin) return;
  const users = await api('/api/users');
  list.insertAdjacentHTML('afterend', '<div class="detail-section" id="recoveryPanel"><h3>Recuperação de acesso</h3><p class="sub">Defina uma senha temporária e informe-a ao membro da equipe. As sessões dele serão encerradas.</p><form class="form" id="recoveryForm"><div class="twocol"><label>Usuário<select id="recoveryUser">'+users.map(u=>'<option value="'+u.id+'">'+u.name+' · @'+u.username+'</option>').join('')+'</select></label><label>Nova senha temporária<input id="recoveryPassword" type="password" minlength="10" required></label></div><div class="actions"><button class="plain">Redefinir senha</button></div></form></div>');
  $('#recoveryForm').onsubmit = async event => {
    event.preventDefault();
    const id = Number($('#recoveryUser').value), user = users.find(item => item.id === id);
    try {
      await api('/api/users', {method:'PATCH', body:JSON.stringify({id, is_admin:user.is_admin, can_create:user.can_create, can_edit:user.can_edit, can_delete:user.can_delete, active:user.active, password:$('#recoveryPassword').value})});
      $('#recoveryPassword').value=''; toast('Senha temporária definida e sessões revogadas.');
    } catch (error) { toast(error.message); }
  };
}

new MutationObserver(() => { addRecoveryPanel().catch(error => console.error(error)); }).observe($('#settings'), {childList:true, subtree:true});
document.addEventListener('DOMContentLoaded', () => { $('#password').onclick = openPassword; });
