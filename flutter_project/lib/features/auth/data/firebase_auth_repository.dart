import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../domain/auth_repository.dart';
import '../domain/user_entity.dart';
import '../../../core/utils/firebase_error_mapper.dart';
import '../../../core/utils/security_utils.dart';

/// Concrete implementation of [AuthRepository] using Firebase Auth and Cloud Firestore.
/// Configured with offline persistence and strict DPDP Act 2023 compliance.
class FirebaseAuthRepository implements AuthRepository {
  final FirebaseAuth _firebaseAuth;
  final FirebaseFirestore _firestore;

  FirebaseAuthRepository({
    FirebaseAuth? firebaseAuth,
    FirebaseFirestore? firestore,
  })  : _firebaseAuth = firebaseAuth ?? FirebaseAuth.instance,
        _firestore = firestore ?? FirebaseFirestore.instance;

  @override
  Stream<UserEntity?> get authStateChanges {
    return _firebaseAuth.authStateChanges().asyncMap((firebaseUser) async {
      if (firebaseUser == null) return null;
      return await _fetchUserEntity(firebaseUser.uid, firebaseUser);
    });
  }

  @override
  UserEntity? get currentUser {
    final firebaseUser = _firebaseAuth.currentUser;
    if (firebaseUser == null) return null;
    return UserEntity(
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      phoneNumber: firebaseUser.phoneNumber,
      displayName: firebaseUser.displayName ?? 'PillSync User',
      dpdpConsentGiven: true,
      createdAt: firebaseUser.metadata.creationTime ?? DateTime.now(),
    );
  }

  Future<UserEntity?> _fetchUserEntity(String uid, User? firebaseUser) async {
    try {
      final doc = await _firestore.collection('users').doc(uid).get(
            const GetOptions(source: Source.serverAndCache),
          );

      if (doc.exists && doc.data() != null) {
        return UserEntity.fromMap(doc.data()!, uid);
      }

      // If document doesn't exist yet, return minimal safe entity
      return UserEntity(
        uid: uid,
        email: firebaseUser?.email,
        phoneNumber: firebaseUser?.phoneNumber,
        displayName: firebaseUser?.displayName ?? 'PillSync User',
        dpdpConsentGiven: false,
        createdAt: firebaseUser?.metadata.creationTime ?? DateTime.now(),
      );
    } catch (_) {
      return null;
    }
  }

  @override
  Future<UserEntity> signInWithEmail({
    required String email,
    required String password,
  }) async {
    try {
      final cred = await _firebaseAuth.signInWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );

      final user = cred.user!;
      final entity = await _fetchUserEntity(user.uid, user);
      await SecurityUtils.resetFailedAttempts();
      return entity ??
          UserEntity(
            uid: user.uid,
            email: user.email,
            displayName: user.displayName ?? 'PillSync User',
            dpdpConsentGiven: true,
            createdAt: DateTime.now(),
          );
    } catch (e) {
      await SecurityUtils.recordFailedAttempt();
      throw Exception(FirebaseErrorMapper.getFriendlyMessage(e));
    }
  }

  @override
  Future<UserEntity> signUpWithEmail({
    required String email,
    required String password,
    required String displayName,
    required bool dpdpConsentGiven,
  }) async {
    if (!dpdpConsentGiven) {
      throw Exception('DPDP Act 2023 requires explicit user consent to proceed.');
    }

    try {
      final cred = await _firebaseAuth.createUserWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );

      final user = cred.user!;
      await user.updateDisplayName(displayName.trim());

      final newUser = UserEntity(
        uid: user.uid,
        email: user.email,
        displayName: displayName.trim(),
        dpdpConsentGiven: true,
        dpdpConsentTimestamp: DateTime.now(),
        dpdpPolicyVersion: '1.0.0-dpdp-2023',
        createdAt: DateTime.now(),
      );

      // Persist user record & consent audit trail in Firestore
      await _firestore.collection('users').doc(user.uid).set(
            newUser.toMap(),
            SetOptions(merge: true),
          );

      await SecurityUtils.resetFailedAttempts();
      return newUser;
    } catch (e) {
      throw Exception(FirebaseErrorMapper.getFriendlyMessage(e));
    }
  }

  @override
  Future<void> sendPhoneOtp({
    required String phoneNumber,
    required Function(String verificationId, int? resendToken) onCodeSent,
    required Function(String error) onError,
    Function(dynamic user)? onAutoVerified,
  }) async {
    try {
      await _firebaseAuth.verifyPhoneNumber(
        phoneNumber: phoneNumber.startsWith('+') ? phoneNumber : '+91$phoneNumber',
        timeout: const Duration(seconds: 60),
        verificationCompleted: (PhoneAuthCredential credential) async {
          if (onAutoVerified != null) {
            final userCred = await _firebaseAuth.signInWithCredential(credential);
            onAutoVerified(userCred.user);
          }
        },
        verificationFailed: (FirebaseAuthException e) {
          onError(FirebaseErrorMapper.getFriendlyMessage(e));
        },
        codeSent: (String verificationId, int? resendToken) {
          onCodeSent(verificationId, resendToken);
        },
        codeAutoRetrievalTimeout: (String verificationId) {
          // Auto retrieval timeout
        },
      );
    } catch (e) {
      onError(FirebaseErrorMapper.getFriendlyMessage(e));
    }
  }

  @override
  Future<UserEntity> verifyPhoneOtp({
    required String verificationId,
    required String smsCode,
    String? displayName,
    required bool dpdpConsentGiven,
  }) async {
    try {
      final credential = PhoneAuthProvider.credential(
        verificationId: verificationId,
        smsCode: smsCode.trim(),
      );

      final userCred = await _firebaseAuth.signInWithCredential(credential);
      final user = userCred.user!;

      if (displayName != null && displayName.isNotEmpty) {
        await user.updateDisplayName(displayName);
      }

      final docRef = _firestore.collection('users').doc(user.uid);
      final snapshot = await docRef.get();

      UserEntity entity;
      if (!snapshot.exists) {
        entity = UserEntity(
          uid: user.uid,
          phoneNumber: user.phoneNumber,
          displayName: displayName ?? 'PillSync Patient',
          dpdpConsentGiven: dpdpConsentGiven,
          dpdpConsentTimestamp: DateTime.now(),
          dpdpPolicyVersion: '1.0.0-dpdp-2023',
          createdAt: DateTime.now(),
        );
        await docRef.set(entity.toMap());
      } else {
        entity = UserEntity.fromMap(snapshot.data()!, user.uid);
      }

      await SecurityUtils.resetFailedAttempts();
      return entity;
    } catch (e) {
      await SecurityUtils.recordFailedAttempt();
      throw Exception(FirebaseErrorMapper.getFriendlyMessage(e));
    }
  }

  @override
  Future<void> sendPasswordResetEmail(String email) async {
    try {
      await _firebaseAuth.sendPasswordResetEmail(email: email.trim());
    } catch (e) {
      throw Exception(FirebaseErrorMapper.getFriendlyMessage(e));
    }
  }

  @override
  Future<void> signOut() async {
    await _firebaseAuth.signOut();
  }

  @override
  Future<void> deleteAccountAndData({
    required String confirmPasswordOrPin,
  }) async {
    final user = _firebaseAuth.currentUser;
    if (user == null) {
      throw Exception('No authenticated user session found.');
    }

    try {
      // Re-authentication prior to deletion if email user
      if (user.email != null && confirmPasswordOrPin.isNotEmpty) {
        final AuthCredential cred = EmailAuthProvider.credential(
          email: user.email!,
          password: confirmPasswordOrPin,
        );
        await user.reauthenticateWithCredential(cred);
      }

      // 1. Delete user documents and subcollections in Firestore
      final userDoc = _firestore.collection('users').doc(user.uid);
      final subcollections = ['prescriptions', 'reminders', 'schedule', 'logs'];
      for (final sub in subcollections) {
        final docs = await userDoc.collection(sub).get();
        for (final doc in docs.docs) {
          await doc.reference.delete();
        }
      }
      await userDoc.delete();

      // 2. Wipe secure storage (PIN, biometric flags, salts)
      await SecurityUtils.wipeAllSecureData();

      // 3. Delete Firebase Auth user
      await user.delete();
    } catch (e) {
      throw Exception(
        'Account deletion failed: ${FirebaseErrorMapper.getFriendlyMessage(e)}',
      );
    }
  }

  @override
  Future<void> updateSecurityPreferences({
    required bool hasPin,
    required bool biometricsEnabled,
  }) async {
    final user = _firebaseAuth.currentUser;
    if (user == null) return;

    await _firestore.collection('users').doc(user.uid).update({
      'security.hasPinConfigured': hasPin,
      'security.biometricsEnabled': biometricsEnabled,
      'updatedAt': DateTime.now().toIso8601String(),
    });
  }
}
