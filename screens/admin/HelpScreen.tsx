import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigationTypes';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '@shared/adminService';
import { sharedStyles } from '../../styles/sharedStyles';
import InlineBackButton from '../../components/InlineBackButton';

type HelpScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const HelpScreen = () => {
  const navigation = useNavigation<HelpScreenNavigationProp>();
  const { user } = useAuth();
  const [helpRequests, setHelpRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [responseText, setResponseText] = useState('');

  useEffect(() => {
    const checkAdminAndLoad = async () => {
      if (!user) {
        Alert.alert('Access Denied', 'You must be logged in to access this page');
        navigation.goBack();
        return;
      }

      const isAdminUser = await isAdmin(user.uid);
      if (!isAdminUser) {
        Alert.alert('Access Denied', 'You do not have permission to access this page');
        navigation.goBack();
        return;
      }

      fetchHelpRequests();
    };

    checkAdminAndLoad();
  }, [user, navigation]);

  const fetchHelpRequests = async () => {
    try {
      setLoading(true);
      // The legacy admin help requests API is not wired in the current shared services.
      // For now we load an empty list to keep the screen functional without runtime errors.
      setHelpRequests([]);
    } catch (error) {
      console.error('Error fetching help requests:', error);
      Alert.alert('Error', 'Failed to fetch help requests');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
  };

  const handleFilter = (status: string) => {
    setFilterStatus(status);
  };

  const handleRequestPress = (request: any) => {
    setSelectedRequest(request);
    setResponseText(request.response || '');
  };

  const handleBackToList = () => {
    setSelectedRequest(null);
    setResponseText('');
  };

  const handleRespond = async () => {
    if (!responseText.trim()) {
      Alert.alert('Error', 'Response cannot be empty');
      return;
    }

    // The legacy respondToHelpRequest API is not available in the current shared admin service.
    // To avoid compile-time and runtime errors in this mobile build, we disable sending.
    Alert.alert('Not Implemented', 'Sending responses to help requests is not yet available in this mobile build.');
  };

  const filteredRequests = helpRequests.filter(request => {
    const matchesSearch = request.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         request.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         request.userEmail.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || request.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading help requests...</Text>
      </View>
    );
  }

  if (selectedRequest) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.detailHeader}>
          <InlineBackButton label="Înapoi la listă" onPress={handleBackToList} />
          <Text style={styles.detailTitle}>Help Request Details</Text>
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.detailLabel}>Subject:</Text>
          <Text style={styles.detailValue}>{selectedRequest.subject}</Text>
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.detailLabel}>From:</Text>
          <Text style={styles.detailValue}>{selectedRequest.userEmail}</Text>
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.detailLabel}>Status:</Text>
          <Text style={[styles.detailValue, selectedRequest.status === 'resolved' ? styles.resolvedStatus : styles.pendingStatus]}>
            {selectedRequest.status}
          </Text>
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.detailLabel}>Date:</Text>
          <Text style={styles.detailValue}>{new Date(selectedRequest.createdAt).toLocaleString()}</Text>
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.detailLabel}>Message:</Text>
          <Text style={styles.detailMessage}>{selectedRequest.message}</Text>
        </View>

        {selectedRequest.response && (
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Previous Response:</Text>
            <Text style={styles.detailResponse}>{selectedRequest.response}</Text>
          </View>
        )}

        <Text style={styles.responseLabel}>Your Response:</Text>
        <TextInput
          style={styles.responseInput}
          multiline
          value={responseText}
          onChangeText={setResponseText}
          placeholder="Type your response here..."
        />

        <TouchableOpacity onPress={handleRespond} style={styles.respondButton}>
          <Text style={styles.respondButtonText}>Send Response</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Help Center - Admin</Text>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search help requests..."
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      <View style={styles.filterContainer}>
        <Text style={styles.filterLabel}>Filter by status:</Text>
        <View style={styles.filterButtons}>
          <TouchableOpacity
            style={[styles.filterButton, filterStatus === 'all' && styles.activeFilter]}
            onPress={() => handleFilter('all')}
          >
            <Text style={[styles.filterButtonText, filterStatus === 'all' && styles.activeFilterText]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterStatus === 'pending' && styles.activeFilter]}
            onPress={() => handleFilter('pending')}
          >
            <Text style={[styles.filterButtonText, filterStatus === 'pending' && styles.activeFilterText]}>Pending</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterStatus === 'resolved' && styles.activeFilter]}
            onPress={() => handleFilter('resolved')}
          >
            <Text style={[styles.filterButtonText, filterStatus === 'resolved' && styles.activeFilterText]}>Resolved</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.requestCount}>Showing {filteredRequests.length} help requests</Text>

      {filteredRequests.length === 0 ? (
        <Text style={styles.noRequests}>No help requests found</Text>
      ) : (
        <ScrollView style={styles.requestsContainer}>
          {filteredRequests.map((request) => (
            <TouchableOpacity
              key={request.id}
              style={styles.requestCard}
              onPress={() => handleRequestPress(request)}
            >
              <View style={styles.requestHeader}>
                <Text style={styles.requestSubject}>{request.subject}</Text>
                <Text style={[styles.requestStatus, request.status === 'resolved' ? styles.resolvedStatus : styles.pendingStatus]}>
                  {request.status}
                </Text>
              </View>
              <Text style={styles.requestFrom}>From: {request.userEmail}</Text>
              <Text style={styles.requestDate}>{new Date(request.createdAt).toLocaleString()}</Text>
              <Text style={styles.requestPreview} numberOfLines={2}>
                {request.message}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  searchContainer: {
    marginBottom: 15,
  },
  searchInput: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
  },
  filterContainer: {
    marginBottom: 15,
  },
  filterLabel: {
    fontSize: 16,
    marginBottom: 8,
    color: '#555',
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  filterButton: {
    padding: 8,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
  },
  filterButtonText: {
    color: '#555',
    fontSize: 14,
  },
  activeFilter: {
    backgroundColor: '#4CAF50',
  },
  activeFilterText: {
    color: 'white',
  },
  requestCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  noRequests: {
    textAlign: 'center',
    marginTop: 20,
    color: '#999',
    fontSize: 16,
  },
  requestsContainer: {
    flex: 1,
  },
  requestCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestSubject: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  requestStatus: {
    fontSize: 12,
    padding: 4,
    borderRadius: 4,
    textAlign: 'center',
    minWidth: 80,
  },
  pendingStatus: {
    backgroundColor: '#FFF3CD',
    color: '#856404',
  },
  resolvedStatus: {
    backgroundColor: '#D4EDDA',
    color: '#155724',
  },
  requestFrom: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  requestDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  requestPreview: {
    fontSize: 14,
    color: '#555',
  },
  detailHeader: {
    marginBottom: 20,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  detailSection: {
    marginBottom: 15,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
  },
  detailMessage: {
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 4,
  },
  detailResponse: {
    fontSize: 16,
    color: '#333',
    backgroundColor: '#e8f5e9',
    padding: 10,
    borderRadius: 4,
  },
  responseLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 8,
    color: '#333',
  },
  responseInput: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 15,
  },
  respondButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  respondButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
});

export default HelpScreen;
