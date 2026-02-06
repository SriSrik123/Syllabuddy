import { useState, useEffect, useRef } from 'react';
import { friendsAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  Users,
  Loader2,
  Check,
  X,
  Trash2,
  Clock,
  Send,
  Search,
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

interface SearchResult {
  _id: string;
  name: string;
  email: string;
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { loadAll(); }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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

  const handleSearch = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await friendsAPI.search(value.trim());
        setSearchResults(res.data);
        setShowResults(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const handleSendRequest = async (user: SearchResult) => {
    setSending(user._id);
    try {
      await friendsAPI.sendRequest({ userId: user._id });
      toast.success(`Friend request sent to ${user.name}!`);
      setQuery('');
      setShowResults(false);
      setSearchResults([]);
      loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send request');
    } finally {
      setSending(null);
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

  // Check if a search result is already a friend or has a pending request
  const getStatus = (userId: string): 'friend' | 'pending' | null => {
    if (friends.some(f => f.user._id === userId)) return 'friend';
    if (outgoing.some(r => r.recipient._id === userId)) return 'pending';
    if (incoming.some(r => r.requester._id === userId)) return 'pending';
    return null;
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

      {/* Search for friends */}
      <div className="mb-6 relative" ref={searchRef}>
        <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Find a friend
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
          )}
        </div>

        {/* Search results dropdown */}
        {showResults && (
          <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {searchResults.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                No users found
              </div>
            ) : (
              searchResults.map((user) => {
                const status = getStatus(user._id);
                return (
                  <div
                    key={user._id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                    </div>
                    {status === 'friend' ? (
                      <span className="text-[11px] text-green-600 dark:text-green-400 font-medium">Friends</span>
                    ) : status === 'pending' ? (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Pending</span>
                    ) : (
                      <button
                        onClick={() => handleSendRequest(user)}
                        disabled={sending === user._id}
                        className="px-2.5 py-1 bg-blue-600 text-white rounded text-[11px] font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                      >
                        {sending === user._id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Send className="w-3 h-3" />
                        )}
                        Add
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

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
              Search for classmates by name to see their progress on shared assignments.
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
