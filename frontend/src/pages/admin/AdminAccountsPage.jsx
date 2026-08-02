import { useEffect, useState } from "react";
import { Button } from "../../components/Button.jsx";
import { Card } from "../../components/Card.jsx";
import {
  ClockIcon,
  RefreshIcon,
  SearchIcon,
  ShieldCheckIcon,
  TrashIcon,
  UsersIcon,
} from "../../components/Icons.jsx";
import { Modal } from "../../components/Modal.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { adminService } from "../../services/adminService.js";
import { normalizeApiError } from "../../services/api.js";

/**
 * Formats an account creation timestamp.
 * @param {string|Date} value - API timestamp.
 * @returns {string} Localized short date.
 * @sideEffects None.
 */
function formatDate(value) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}

/**
 * Renders admin-only family account management inside the shared admin shell.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Account metrics, filters, table, and deletion modal.
 * @sideEffects Loads family users and deletes confirmed unlinked accounts.
 */
export function AdminAccountsPage() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const { showToast } = useToast();

  /**
   * Loads family accounts from the protected admin API.
   * @param {string} [searchValue=search] - Optional current search value.
   * @returns {Promise<void>}
   * @sideEffects Calls the API and updates page state.
   */
  async function loadUsers(searchValue = search) {
    setIsLoading(true);
    setError("");
    try {
      const data = await adminService.listFamilyUsers(searchValue);
      setUsers(data.users);
    } catch (requestError) {
      setError(normalizeApiError(requestError).message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadUsers("");
  }, []);

  /**
   * Applies the current name/email search through the admin API.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Search form submission.
   * @returns {Promise<void>}
   * @sideEffects Calls the account-list API and updates visible results.
   */
  async function handleSearch(event) {
    event.preventDefault();
    await loadUsers(search);
  }

  /**
   * Permanently deletes the selected unlinked family account.
   * @param {void} _unused - Uses the selected user in component state.
   * @returns {Promise<void>}
   * @sideEffects Calls the deletion API, updates the list, and shows feedback.
   */
  async function handleDelete() {
    if (!selectedUser) return;
    setIsDeleting(true);
    setError("");
    try {
      const result = await adminService.deleteFamilyUser(selectedUser.id);
      setUsers((current) => current.filter((item) => item.id !== result.deletedUserId));
      setSelectedUser(null);
      showToast("Family account deleted.", "success");
    } catch (requestError) {
      setError(normalizeApiError(requestError).message);
      setSelectedUser(null);
    } finally {
      setIsDeleting(false);
    }
  }

  const visibleUsers = users.filter((familyUser) => {
    if (verificationFilter === "verified") return familyUser.isVerified;
    if (verificationFilter === "unverified") return !familyUser.isVerified;
    return true;
  });

  return (
    <>
      <div className="admin-heading">
        <div><span className="eyebrow">Identity oversight</span><h1>Family accounts</h1><p>Review registrations, verification state, and linked care records.</p></div>
        <Button variant="secondary" onClick={() => loadUsers(search)} isLoading={isLoading}><RefreshIcon size={18} /> Refresh data</Button>
      </div>
      <section className="admin-metrics" aria-label="Account overview">
        <Card className="metric-card"><span className="metric-card__icon"><UsersIcon /></span><div><small>Total family accounts</small><strong>{users.length}</strong><span>Registered on the platform</span></div></Card>
        <Card className="metric-card"><span className="metric-card__icon metric-card__icon--success"><ShieldCheckIcon /></span><div><small>Verified accounts</small><strong>{users.filter((item) => item.isVerified).length}</strong><span>Ready to sign in</span></div></Card>
        <Card className="metric-card"><span className="metric-card__icon metric-card__icon--pending"><ClockIcon /></span><div><small>Awaiting verification</small><strong>{users.filter((item) => !item.isVerified).length}</strong><span>Email not confirmed</span></div></Card>
      </section>
      <Card className="account-panel">
        <div className="account-toolbar">
          <div><h2>Account directory</h2><p>{visibleUsers.length} account{visibleUsers.length === 1 ? "" : "s"} shown</p></div>
          <div className="account-toolbar__controls">
            <form className="admin-search" onSubmit={handleSearch}>
              <SearchIcon size={18} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search family accounts" placeholder="Search name or email" />
              <button type="submit" aria-label="Submit search">Search</button>
            </form>
            <select className="admin-filter" value={verificationFilter} onChange={(event) => setVerificationFilter(event.target.value)} aria-label="Filter by verification">
              <option value="all">All statuses</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
            </select>
          </div>
        </div>
        <div className="account-table-header" aria-hidden="true"><span>Account</span><span>Status</span><span>Care records</span><span>Joined</span><span>Action</span></div>
        {error && <div className="alert alert--error">{error}</div>}
        {isLoading ? (
          <div className="page-loader-inline"><span className="spinner" /> Loading accounts</div>
        ) : (
          <div className="account-list">
            {!visibleUsers.length && <div className="empty-state"><h2>No matching accounts</h2><p>Try another search or verification filter.</p></div>}
            {visibleUsers.map((familyUser) => (
              <article className="account-row" key={familyUser.id}>
                <span className="profile-avatar">{familyUser.name[0]}</span>
                <div className="account-row__identity"><strong>{familyUser.name}</strong><span>{familyUser.email}</span></div>
                <div className="account-row__status"><span className={familyUser.isVerified ? "status-badge status-badge--success" : "status-badge"}>{familyUser.isVerified ? "Verified" : "Unverified"}</span><small>{familyUser.authMethod.replaceAll("-", " ")}</small></div>
                <div className="account-row__records"><strong>{familyUser.linkedElderlyProfileCount}</strong><span>linked profile{familyUser.linkedElderlyProfileCount === 1 ? "" : "s"}</span></div>
                <time dateTime={familyUser.createdAt}>{formatDate(familyUser.createdAt)}</time>
                <button className="icon-button delete-action" disabled={familyUser.linkedElderlyProfileCount > 0} title={familyUser.linkedElderlyProfileCount > 0 ? "Linked health records must be transferred or archived first." : "Delete family account"} aria-label={`Delete ${familyUser.email}`} onClick={() => setSelectedUser(familyUser)}><TrashIcon size={18} /></button>
              </article>
            ))}
          </div>
        )}
      </Card>
      <Modal isOpen={Boolean(selectedUser)} title="Delete family account?" onClose={() => setSelectedUser(null)}>
        <p>This permanently removes <strong>{selectedUser?.email}</strong> and any unused verification links. This cannot be undone.</p>
        <div className="modal-actions"><Button variant="secondary" onClick={() => setSelectedUser(null)}>Cancel</Button><Button isLoading={isDeleting} onClick={handleDelete}><TrashIcon size={17} /> Delete account</Button></div>
      </Modal>
    </>
  );
}
