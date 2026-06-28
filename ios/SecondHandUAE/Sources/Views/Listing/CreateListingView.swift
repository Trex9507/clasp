import SwiftUI
import PhotosUI

struct CreateListingView: View {
    @Environment(\.dismiss) private var dismiss

    // Form state
    @State private var title = ""
    @State private var description = ""
    @State private var selectedCategory: Category?
    @State private var selectedSubcategory: Category?
    @State private var selectedBrand: Brand?
    @State private var size = ""
    @State private var condition = "like_new"
    @State private var price = ""
    @State private var deliveryOptions = "both"

    // Photos
    @State private var selectedPhotos: [PhotosPickerItem] = []
    @State private var photoImages: [UIImage] = []

    // Verification
    @State private var verificationCode = ""
    @State private var wantsVerification = true
    @State private var verificationPhotoItem: PhotosPickerItem?
    @State private var verificationImage: UIImage?

    // Data
    @State private var brands: [Brand] = []
    @State private var categories: [Category] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var isSubmitting = false
    @State private var uploadProgress = ""

    let conditions = [
        ("new_with_tags", "New with tags"),
        ("like_new", "Like new"),
        ("good", "Good"),
        ("fair", "Fair"),
    ]

    let deliveryChoices = [
        ("hand_off", "Hand-off only"),
        ("courier", "Courier only"),
        ("both", "Both"),
    ]

    private var brandRequiresVerification: Bool {
        guard let brand = selectedBrand else { return false }
        return brand.verificationType != "none"
    }

    var body: some View {
        NavigationStack {
            Form {
                // Photos
                Section("Photos (min 1, max 8)") {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(photoImages.indices, id: \.self) { i in
                                Image(uiImage: photoImages[i])
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 80, height: 80)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            }

                            if photoImages.count < 8 {
                                PhotosPicker(selection: $selectedPhotos, maxSelectionCount: 8 - photoImages.count, matching: .images) {
                                    RoundedRectangle(cornerRadius: 8)
                                        .fill(Color(.systemGray5))
                                        .frame(width: 80, height: 80)
                                        .overlay {
                                            Image(systemName: "plus.circle.fill")
                                                .font(.title2)
                                                .foregroundStyle(.secondary)
                                        }
                                }
                            }
                        }
                    }
                }

                // Category
                Section("Category") {
                    Picker("Category", selection: $selectedCategory) {
                        Text("Select...").tag(nil as Category?)
                        ForEach(categories) { cat in
                            Text(cat.name).tag(cat as Category?)
                        }
                    }

                    if let parent = selectedCategory, let children = parent.children, !children.isEmpty {
                        Picker("Subcategory", selection: $selectedSubcategory) {
                            Text("Select...").tag(nil as Category?)
                            ForEach(children) { sub in
                                Text(sub.name).tag(sub as Category?)
                            }
                        }
                    }
                }

                // Brand
                Section("Brand") {
                    Picker("Brand", selection: $selectedBrand) {
                        Text("None / Other").tag(nil as Brand?)
                        ForEach(brands) { brand in
                            Text(brand.name).tag(brand as Brand?)
                        }
                    }
                }

                // Verification step (conditional)
                if brandRequiresVerification {
                    Section {
                        Toggle("I want to verify this item", isOn: $wantsVerification)

                        if wantsVerification {
                            if let instructions = selectedBrand?.verificationInstructions {
                                Text(instructions)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            TextField("Verification code", text: $verificationCode)
                                .autocapitalization(.none)

                            PhotosPicker(selection: $verificationPhotoItem, matching: .images) {
                                if verificationImage != nil {
                                    Label("Photo added", systemImage: "checkmark.circle.fill")
                                        .foregroundStyle(.green)
                                } else {
                                    Label("Upload code/tag photo", systemImage: "camera")
                                }
                            }

                            Text("The \"Verified\" badge means the seller provided a code in the expected format plus a photo. It does not certify authenticity. The platform assumes no responsibility for the authenticity of items.")
                                .font(.caption2)
                                .foregroundStyle(.orange)
                        }
                    } header: {
                        Text("Verification")
                    } footer: {
                        if !wantsVerification {
                            Text("Skipping verification — the item will be listed as \"Unverified\".")
                        }
                    }
                }

                // Details
                Section("Details") {
                    TextField("Title", text: $title)
                    TextField("Description (optional)", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                    TextField("Size (optional)", text: $size)
                    Picker("Condition", selection: $condition) {
                        ForEach(conditions, id: \.0) { c in
                            Text(c.1).tag(c.0)
                        }
                    }
                }

                // Pricing & delivery
                Section("Pricing & Delivery") {
                    HStack {
                        Text("AED")
                        TextField("Price", text: $price)
                            .keyboardType(.decimalPad)
                    }
                    Picker("Delivery", selection: $deliveryOptions) {
                        ForEach(deliveryChoices, id: \.0) { d in
                            Text(d.1).tag(d.0)
                        }
                    }
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(.red)
                            .font(.caption)
                    }
                }

                Section {
                    Button {
                        submit()
                    } label: {
                        if isSubmitting {
                            VStack(spacing: 4) {
                                ProgressView().frame(maxWidth: .infinity)
                                if !uploadProgress.isEmpty {
                                    Text(uploadProgress)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        } else {
                            Text("Publish Listing").frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(title.isEmpty || selectedSubcategory == nil || price.isEmpty || photoImages.isEmpty || isSubmitting)
                }
            }
            .navigationTitle("Sell an Item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .task { await loadData() }
            .onChange(of: selectedPhotos) { _, items in
                Task { await loadImages(items) }
            }
            .onChange(of: verificationPhotoItem) { _, item in
                Task { await loadVerificationImage(item) }
            }
        }
    }

    private func loadImages(_ items: [PhotosPickerItem]) async {
        for item in items {
            if let data = try? await item.loadTransferable(type: Data.self),
               let image = UIImage(data: data) {
                photoImages.append(image)
            }
        }
        selectedPhotos = []
    }

    private func loadVerificationImage(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        if let data = try? await item.loadTransferable(type: Data.self),
           let image = UIImage(data: data) {
            verificationImage = image
        }
    }

    private func loadData() async {
        isLoading = true
        async let b = APIClient.shared.getBrands()
        async let c = APIClient.shared.getCategories()
        do {
            brands = try await b
            categories = try await c
        } catch {}
        isLoading = false
    }

    private func submit() {
        guard let priceValue = Double(price) else {
            errorMessage = "Enter a valid price"
            return
        }

        isSubmitting = true
        errorMessage = nil

        Task {
            do {
                // Upload listing photos
                uploadProgress = "Uploading photos..."
                var photoUrls: [String] = []
                for (i, image) in photoImages.enumerated() {
                    uploadProgress = "Uploading photo \(i + 1) of \(photoImages.count)..."
                    guard let data = image.jpegData(compressionQuality: 0.8) else { continue }
                    let url = try await APIClient.shared.uploadPhoto(imageData: data, folder: "listing")
                    photoUrls.append(url)
                }

                // Upload verification photo if needed
                var verificationPhotoUrl: String?
                if brandRequiresVerification && wantsVerification && !verificationCode.isEmpty {
                    if let vImage = verificationImage, let data = vImage.jpegData(compressionQuality: 0.8) {
                        uploadProgress = "Uploading verification photo..."
                        verificationPhotoUrl = try await APIClient.shared.uploadPhoto(imageData: data, folder: "verification")
                    }
                }

                uploadProgress = "Creating listing..."
                let req = CreateListingRequest(
                    title: title,
                    description: description.isEmpty ? nil : description,
                    categoryId: selectedSubcategory?.id ?? selectedCategory?.id ?? "",
                    brandId: selectedBrand?.id,
                    size: size.isEmpty ? nil : size,
                    condition: condition,
                    price: priceValue,
                    deliveryOptions: deliveryOptions,
                    verificationCode: (brandRequiresVerification && wantsVerification && !verificationCode.isEmpty) ? verificationCode : nil,
                    verificationPhotoUrl: verificationPhotoUrl,
                    photoUrls: photoUrls.isEmpty ? nil : photoUrls
                )

                _ = try await APIClient.shared.createListing(req)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
            isSubmitting = false
            uploadProgress = ""
        }
    }
}
