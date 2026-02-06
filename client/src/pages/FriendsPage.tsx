import { useState, useEffect } from 'react';
import { friendsAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  UserPlus,
  Users,
  Loader2,
  Check,
  X,
  Mail,
  Trash2,
  Clock,
  Send,
} from 'lucide-react';

interface FriendUser {
  _id: string;
  name: string;
  email: string;
}

interface Friend {
  friendshipId: string;
  user: FriendUser;
}

interface FriendRequest {
  _id: string;
  requester: FriendUser;
  recipient: FriendUser;
  createdAt: string;
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        friendsAPI.list(),
        friendsAPI.getRequests(),
      ]);
      setFriends(friendsRes.data);
      setIncoming(requestsRes.data.incoming);
      setOutgoing(requestsRes.data.outgoing);
    } catch {
      toast.error('Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    try {
      await friendsAPI.sendRequest(email.trim());
      toast.success('Friend request sent!');
      setEmail('');
      loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send request');
    } finally {
      setSending(false);
    }
  };

  const handleAccept = async (id: string) => {
    try {
      await friendsAPI.acceptRequest(id);
      toast.success('Friend added!');
      loadAll();
    } catch {
      toast.error('Failed to accept');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await friendsAPI.rejectRequest(id);
      loadAll();
    } catch {
      toast.error('Failed to reject');
    }
  };

  const handleRemove = async (friendshipId: string, name: string) => {
    if (!confirm(`Remove ${name} from your friends?`)) return;
    try {
      await friendsAPI.removeFriend(friendshipId);
      toast.success('Friend removed');
      loadAll();
    } catch {
      toast.error('Failed to remove');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Friends</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Connect with classmates to see each other's progress on assignments and exams.
        </p>
      </div>

      {/* Add friend */}
      <form onSubmit={handleSendRequest} className="mb-6">
        <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Add a friend by email
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@university.edu"
              required
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={sending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-[13px] font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Send
          </button>
        </div>
      </form>

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <div className="mb-6">
          <h2 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5">
            Pending Requests ({incoming.length})
          </h2>
          <div className="bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
            {incoming.map((req) => (
              <div key={req._id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                    {req.requester.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{req.requester.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{req.requester.email}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleAccept(req._id)}
                    className="p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    title="Accept"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleReject(req._id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                    title="Decline"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outgoing requests */}
      {outgoing.length > 0 && (
        <div className="mb-6">
          <h2 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5">
            Sent Requests ({outgoing.length})
          </h2>
          <div className="bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
            {outgoing.map((req) => (
              <div key={req._id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center flex-shrink-0">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{req.recipient.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{req.recipient.email}</p>
                </div>
                <button
                  onClick={() => handleReject(req._id)}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends list */}
      <div>
        <h2 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5">
          Friends ({friends.length})
        </h2>

        {friends.length === 0 ? (
          <div className="border border-dashed border-gray-300 dark:border-gray-700 rounded-md p-6 text-center">
            <Users className="w-5 h-5 text-blue-300 dark:text-blue-700 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No friends yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Add classmates by email to see their progress on shared assignments.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
            {friends.map((f) => (
              <div key={f.friendshipId} className="flex items-center gap-3 px-4 py-3 group">
                <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                    {f.user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{f.user.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{f.user.email}</p>
                </div>
                <button
                  onClick={() => handleRemove(f.friendshipId, f.user.name)}
                  className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 rounded transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove friend"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
