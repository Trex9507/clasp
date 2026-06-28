import SwiftUI
import PhotosUI

struct CreateListingView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var description = ""
    @State private var selectedCategory: Category?
    @State private var selectedSubcategory: Category?
    @State private var selectedBrand: Brand?
    @State private var size = ""
    @State private var condition = "like_new"
    @State private var price = ""
    @State private var deliveryOptions = "both"

    @State private var selectedPhotos: [PhotosPickerItem] = []
    @State private var photoImages: [UIImage] = []

    @State private var verificationCode = ""
    @State private var wantsVerification = true
    @State private var verificationPhotoItem: PhotosPickerItem?
    @State private var verificationImage: UIImage?

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
            ScrollView {
                VStack(spacing: 24) {
                    // Photos section
                    VStack(alignment: .leading, spacing: 10) {
                        sectionLabel("Photos", subtitle: "Min 1, max 8")
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 10) {
                                ForEach(photoImages.indices, id: \.self) { i in
                                    ZStack(alignment: .topTrailing) {
                                        Image(uiImage: photoImages[i])
                                            .resizable()
                                            .scaledToFill()
                                            .frame(width: 90, height: 90)
                                            .clipShape(RoundedRectangle(cornerRadius: 12))

                                        Button {
                                            photoImages.remove(at: i)
                                        } label: {
                                            Image(systemName: "xmark.circle.fill")
                                                .font(.body)
                                                .foregroundStyle(.white)
                                                .shadow(radius: 2)
                                        }
                                        .offset(x: 6, y: -6)
                                    }
                                }

                                if photoImages.count < 8 {
                                    PhotosPicker(selection: $selectedPhotos, maxSelectionCount: 8 - photoImages.count, matching: .images) {
                                        VStack(spacing: 6) {
                                            Image(systemName: "plus")
                                                .font(.title3)
                                            Text("Add")
                                                .font(.caption2)
                                        }
                                        .foregroundStyle(.secondary)
                                        .frame(width: 90, height: 90)
                                        .background(Color(.tertiarySystemFill))
                                        .clipShape(RoundedRectangle(cornerRadius: 12))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 12)
                                                .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [6]))
                                                .foregroundStyle(Color(.systemGray4))
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // Category
                    VStack(alignment: .leading, spacing: 10) {
                        sectionLabel("Category")
                        Picker("Category", selection: $selectedCategory) {
                            Text("Select category...").tag(nil as Category?)
                            ForEach(categories) { cat in
                                Text(cat.name).tag(cat as Category?)
                            }
                        }
                        .pickerStyle(.menu)
                        .padding(14)
                        .background(Color(.tertiarySystemFill))
                        .clipShape(RoundedRectangle(cornerRadius: 12))

                        if let parent = selectedCategory, let children = parent.children, !children.isEmpty {
                            Picker("Subcategory", selection: $selectedSubcategory) {
                                Text("Select subcategory...").tag(nil as Category?)
                                ForEach(children) { sub in
                                    Text(sub.name).tag(sub as Category?)
                                }
                            }
                            .pickerStyle(.menu)
                            .padding(14)
                            .background(Color(.tertiarySystemFill))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                    }

                    // Brand
                    VStack(alignment: .leading, spacing: 10) {
                        sectionLabel("Brand")
                        Picker("Brand", selection: $selectedBrand) {
                            Text("None / Other").tag(nil as Brand?)
                            ForEach(brands) { brand in
                                Text(brand.name).tag(brand as Brand?)
                            }
                        }
                        .pickerStyle(.menu)
                        .padding(14)
                        .background(Color(.tertiarySystemFill))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }

                    // Verification
                    if brandRequiresVerification {
                        VStack(alignment: .leading, spacing: 12) {
                            sectionLabel("Verification", subtitle: "Optional — adds a Verified badge")

                            Toggle("I want to verify this item", isOn: $wantsVerification)
                                .tint(.blue)

                            if wantsVerification {
                                if let instructions = selectedBrand?.verificationInstructions {
                                    HStack(alignment: .top, spacing: 8) {
                                        Image(systemName: "info.circle")
                                            .foregroundStyle(.blue)
                                            .font(.caption)
                                        Text(instructions)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }

                                TextField("Verification code", text: $verificationCode)
                                    .autocapitalization(.none)
                                    .padding(14)
                                    .background(Color(.tertiarySystemFill))
                                    .clipShape(RoundedRectangle(cornerRadius: 12))

                                PhotosPicker(selection: $verificationPhotoItem, matching: .images) {
                                    HStack(spacing: 10) {
                                        Image(systemName: verificationImage != nil ? "checkmark.circle.fill" : "camera")
                                            .foregroundStyle(verificationImage != nil ? .green : .secondary)
                                        Text(verificationImage != nil ? "Verification photo added" : "Upload code/tag photo")
                                            .font(.subheadline)
                                            .foregroundStyle(verificationImage != nil ? .primary : .secondary)
                                        Spacer()
                                    }
                                    .padding(14)
                                    .background(Color(.tertiarySystemFill))
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                                }

                                HStack(alignment: .top, spacing: 8) {
                                    Image(systemName: "exclamationmark.triangle")
                                        .foregroundStyle(.orange)
                                        .font(.caption)
                                    Text("The \"Verified\" badge means the seller provided a code in the expected format plus a photo. It does not certify authenticity.")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                .padding(12)
                                .background(Color.orange.opacity(0.06))
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                            } else {
                                Text("Skipping verification — the item will be listed as \"Unverified\".")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(16)
                        .background(Color(.secondarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }

                    // Details
                    VStack(alignment: .leading, spacing: 10) {
                        sectionLabel("Details")
                        fieldInput("Title", text: $title)
                        TextField("Description (optional)", text: $description, axis: .vertical)
                            .lineLimit(3...6)
                            .padding(14)
                            .background(Color(.tertiarySystemFill))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        fieldInput("Size (optional)", text: $size)

                        VStack(alignment: .leading, spacing: 6) {
                            Text("Condition").font(.caption.bold()).foregroundStyle(.secondary)
                            HStack(spacing: 6) {
                                ForEach(conditions, id: \.0) { c in
                                    Button {
                                        condition = c.0
                                    } label: {
                                        Text(c.1)
                                            .font(.caption2.weight(.medium))
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 8)
                                            .background(condition == c.0 ? Color.primary : Color(.tertiarySystemFill))
                                            .foregroundStyle(condition == c.0 ? Color(.systemBackground) : .primary)
                                            .clipShape(Capsule())
                                    }
                                }
                            }
                        }
                    }

                    // Pricing & delivery
                    VStack(alignment: .leading, spacing: 10) {
                        sectionLabel("Pricing & Delivery")
                        HStack(spacing: 8) {
                            Text("AED")
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(.secondary)
                            TextField("Price", text: $price)
                                .font(.title3.bold())
                                .keyboardType(.decimalPad)
                        }
                        .padding(14)
                        .background(Color(.tertiarySystemFill))
                        .clipShape(RoundedRectangle(cornerRadius: 12))

                        Picker("Delivery", selection: $deliveryOptions) {
                            ForEach(deliveryChoices, id: \.0) { d in
                                Text(d.1).tag(d.0)
                            }
                        }
                        .pickerStyle(.segmented)
                    }

                    if let errorMessage {
                        Text(errorMessage).font(.caption).foregroundStyle(.red)
                    }

                    // Publish button
                    Button {
                        submit()
                    } label: {
                        if isSubmitting {
                            VStack(spacing: 4) {
                                ProgressView().tint(.white)
                                if !uploadProgress.isEmpty {
                                    Text(uploadProgress)
                                        .font(.caption2)
                                        .foregroundStyle(.white.opacity(0.7))
                                }
                            }
                        } else {
                            Text("Publish Listing")
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(title.isEmpty || selectedSubcategory == nil || price.isEmpty || photoImages.isEmpty || isSubmitting)
                }
                .padding(20)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Sell an Item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .task { await loadData() }
            .onChange(of: selectedPhotos) { _, items in Task { await loadImages(items) } }
            .onChange(of: verificationPhotoItem) { _, item in Task { await loadVerificationImage(item) } }
        }
    }

    @ViewBuilder
    private func sectionLabel(_ title: String, subtitle: String? = nil) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(title).font(.subheadline.bold())
            if let subtitle {
                Text(subtitle).font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    private func fieldInput(_ placeholder: String, text: Binding<String>) -> some View {
        TextField(placeholder, text: text)
            .padding(14)
            .background(Color(.tertiarySystemFill))
            .clipShape(RoundedRectangle(cornerRadius: 12))
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
                uploadProgress = "Uploading photos..."
                var photoUrls: [String] = []
                for (i, image) in photoImages.enumerated() {
                    uploadProgress = "Uploading photo \(i + 1) of \(photoImages.count)..."
                    guard let data = image.jpegData(compressionQuality: 0.8) else { continue }
                    let url = try await APIClient.shared.uploadPhoto(imageData: data, folder: "listing")
                    photoUrls.append(url)
                }

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
